import axios from 'axios';
import { format, parseISO } from 'date-fns';

import AIService from '@contexts/AIService';

// Define shared types for both chat contexts
export interface ChatTask {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  priority: number;
  location?: string;
  isTask?: boolean;
}

export interface ChatAnalysisResponse {
  isCalendarEvent: boolean;
  isCalendarSummaryRequest?: boolean;
  isSpecificTimeQuery?: boolean;
  isTaskPlanning?: boolean;
  needsMoreInfo?: boolean;
  followUpQuestion?: string;
  taskPlan?: {
    title: string;
    description: string;
    subtasks: Array<{
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      priority: number;
    }>;
  };
  events?: Array<{
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    allowReschedule: boolean;
    isTaskPlanEvent?: boolean;
    priority?: number;
  }>;
  timePeriod?: string;
  response?: string;
}

export const analyzeWithAI = async (
  userMessage: string,
  scheduleContext: string,
  isProjectChat: boolean = false,
  chatId: string = 'default'
): Promise<ChatAnalysisResponse> => {
  try {
    // Build the system message with the additional context about whether this is a project chat
    const contextPrefix = isProjectChat ? "This is a PROJECT CHAT with multiple users. Focus on collaboration, team coordination, and project management rather than personal tasks." : "";

    const sys_message = `${contextPrefix}
            You are a helpful assistant that can add events to a calendar and answer general questions.

            USER'S CURRENT SCHEDULE:
            ${scheduleContext}

            IMPORTANT TIMEZONE INSTRUCTIONS:
            - The user's timezone is: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
            - All dates and times in the schedule data include both ISO format and human-readable format
            - When answering questions about times, ALWAYS use the human-readable times (in "readable" fields) which are already in the user's local timezone
            - Never show UTC times to the user, only show times in their local timezone

            When answering questions about the user's schedule, use the above schedule information to provide accurate answers.
            Be specific with dates and times from the schedule when responding to questions like:
            - When is my next meeting?
            - What's on my calendar today?
            - Do I have time for lunch tomorrow?
            - What are my high priority tasks?
            - When is my [specific event] scheduled?

            TASK PLANNING:
            If the user wants to plan out a task (with phrases like "help me plan", "break down this project", "create a schedule for", "organize my task"), respond with JSON in this format:
            {"isTaskPlanning": true, "needsMoreInfo": boolean, "followUpQuestion": "question if more info needed", "taskPlan": {"title": "Main task title", "description": "Overall description", "subtasks": [{"title": "Subtask 1", "description": "Details", "startTime": "ISO", "endTime": "ISO", "priority": 1-10}, ...]}}

            Only set needsMoreInfo to true if you don't have essential information like:
            - What the overall task/project is
            - When it needs to be completed by (deadline)
            - Any specific requirements or constraints

            For calendar requests:
            If a user is asking to add one or more events to their calendar, extract the details for each event in the user's local time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}) and respond with JSON in this format:
            {"isCalendarEvent": true, "events": [{"title": "Event title", "description": "Event description", "location": "Event location", "startTime": "ISO string with timezone offset", "endTime": "ISO string with timezone offset", "allowReschedule": boolean}, {...more events if mentioned...}]}

            Set "allowReschedule" to true if the user is flexible with the timing (phrases like "whenever I'm free", "find a time", "when available") and false if they specifically request an exact time.

            For calendar summary requests:
            If the user is specifically asking for their FULL schedule, agenda, or overview of ALL upcoming events (with phrases like "what's my entire schedule", "show me all my events", "what's my full calendar look like"), respond with:
            {"isCalendarSummaryRequest": true}

            For specific calendar queries:
            If the user is asking about events during a specific time period (like "today", "tomorrow", "this weekend", "next week", "Friday", etc.), respond with:
            {"isSpecificTimeQuery": true, "timePeriod": "today/tomorrow/this weekend/etc", "response": "Your response describing just the events during that time period"}

            Important:
            - When generating timestamps, include the timezone offset in the ISO strings and assume the user is referring to times in their local timezone (${Intl.DateTimeFormat().resolvedOptions().timeZone}).
            - If the user mentions a location (like "at Starbucks" or "in New York"), extract it to the location field. If no location is mentioned, set location to empty string.
            - Keep the title focused on the activity, not the location.
            - If the user mentions multiple events in one message, return all of them in the "events" array.

            For all other requests:
            Provide a helpful, informative response to the user's question or comment.
            Format your response as:

            [AI_RESPONSE]
            {"isCalendarEvent": false, "isCalendarSummaryRequest": false, "isSpecificTimeQuery": false, "response": "Your actual helpful answer addressing the user's question goes here. Be thoughtful and informative."}
            [AI_RESPONSE]

            When determining dates and times, assume today is ${new Date().toDateString()} in time zone ${Intl.DateTimeFormat().resolvedOptions().timeZone}.
            Be forgiving with the user's formatting and extract the key details.

            Remember, keep your response as a valid JSON format. Do not prepend your response with backticks.`;

    const aiService = AIService.getInstance();

    const sessionId = isProjectChat ? `project_${chatId}` : `personal_${chatId}`;

    // initialize if needed
    if (!aiService.isSessionActive(sessionId)) {
      await aiService.startChat(sessionId, sys_message);
    }

    let aiResponse = await aiService.sendMessage(sessionId, userMessage);

    try {
      // Remove AI_RESPONSE tags if present
      aiResponse = aiResponse.replace(/\[AI_RESPONSE\]/g, '').trim();

      // Remove markdown code formatting (```json and ```)
      aiResponse = aiResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

      const parsedResponse = JSON.parse(aiResponse);

      // Handle backward compatibility with the old format (single event)
      if (parsedResponse.isCalendarEvent && parsedResponse.eventDetails) {
        // Convert old format to new format
        return {
          isCalendarEvent: true,
          events: [parsedResponse.eventDetails]
        };
      }

      return parsedResponse;
    } catch (e) {
      console.error("Failed to parse AI response:", aiResponse);
      return {
        isCalendarEvent: false,
        response: "I'm having trouble understanding that. Could you try again?"
      };
    }
  } catch (error) {
    console.error("AI API error:", error);
    return {
      isCalendarEvent: false,
      response: "Sorry, I encountered an error processing your request."
    };
  }
};

// Helper for formatting schedule data consistently
export const formatScheduleForContext = (tasks: ChatTask[]) => {
  if (tasks.length === 0) {
    return "You have no upcoming events or tasks scheduled.";
  }

  // Sort tasks by start time
  const sortedTasks = [...tasks].sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Group by type and date for clearer structure
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0];

  const events = sortedTasks.filter(task => !task.isTask);
  const taskItems = sortedTasks.filter(task => task.isTask);

  // Format date/time in user's timezone
  const formatLocalDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      iso: isoString,
      readable: {
        date: format(date, 'MMMM d, yyyy'),
        time: format(date, 'h:mm a'),
        full: format(date, 'MMMM d, yyyy h:mm a')
      }
    };
  };

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let contextData = {
    timeZone: timeZone,
    events: events.map(event => ({
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      startTime: formatLocalDateTime(event.startTime),
      endTime: formatLocalDateTime(event.endTime),
      isToday: event.startTime.startsWith(todayStr),
      isTomorrow: event.startTime.startsWith(tomorrowStr),
      priority: event.priority
    })),
    tasks: taskItems.map(task => ({
      title: task.title,
      description: task.description || "",
      dueDate: formatLocalDateTime(task.endTime),
      isToday: task.endTime.startsWith(todayStr),
      isTomorrow: task.endTime.startsWith(tomorrowStr),
      priority: task.priority
    }))
  };

  return JSON.stringify(contextData, null, 2);
};

// Calendar conflict checking
export const checkForConflicts = (startTime: string, endTime: string, existingTasks: ChatTask[]) => {
  const newStart = new Date(startTime).getTime();
  const newEnd = new Date(endTime).getTime();

  // Filter to only calendar events (non-tasks) to check for time conflicts
  const calendarEvents = existingTasks.filter(event => !event.isTask);

  // Check for any overlap with existing events
  return calendarEvents.find(event => {
    const eventStart = new Date(event.startTime).getTime();
    const eventEnd = new Date(event.endTime).getTime();

    // Check for overlap: new event starts during existing event OR
    // new event ends during existing event OR
    // new event completely contains existing event
    return (newStart >= eventStart && newStart < eventEnd) ||
          (newEnd > eventStart && newEnd <= eventEnd) ||
          (newStart <= eventStart && newEnd >= eventEnd);
  });
};

// Find an available timeslot for calendar events
export const findNextAvailableSlot = (startTime: string, duration: number, existingTasks: ChatTask[]) => {
  // Convert inputs to milliseconds for easier calculation
  let proposedStart = new Date(startTime).getTime();
  const durationMs = duration * 60 * 1000; // duration in minutes to ms

  const calendarEvents = existingTasks.filter(event => !event.isTask);

  // Sort events by start time
  const sortedEvents = [...calendarEvents].sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  let foundSlot = false;
  let maxTries = 10; // Limit the number of attempts to find a slot
  let tryCount = 0;

  while (!foundSlot && tryCount < maxTries) {
    const proposedEnd = proposedStart + durationMs;

    // Check if this slot works
    const conflict = sortedEvents.find(event => {
      const eventStart = new Date(event.startTime).getTime();
      const eventEnd = new Date(event.endTime).getTime();

      return (proposedStart >= eventStart && proposedStart < eventEnd) ||
              (proposedEnd > eventStart && proposedEnd <= eventEnd) ||
              (proposedStart <= eventStart && proposedEnd >= eventEnd);
    });

    if (!conflict) {
      // We found a slot!
      foundSlot = true;
    } else {
      // Move to the end of the conflicting event and try again
      proposedStart = new Date(conflict.endTime).getTime() + (15 * 60 * 1000); // Add 15 min buffer
      tryCount++;
    }
  }

  if (foundSlot) {
    // Convert back to ISO string
    const newStartTime = new Date(proposedStart).toISOString();
    const newEndTime = new Date(proposedStart + durationMs).toISOString();
    return { newStartTime, newEndTime };
  } else {
    // Couldn't find a slot within reasonable attempts
    return null;
  }
};

// Ensures timezone is correctly represented in ISO string
export const ensureCorrectTimezone = (isoString: string): string => {
  // If the time string already has timezone info, we're good
  if (isoString.includes('+') || isoString.includes('Z')) {
    return isoString;
  }

  // Otherwise, interpret as local time and add timezone info
  const date = new Date(isoString);
  return date.toISOString();
};
