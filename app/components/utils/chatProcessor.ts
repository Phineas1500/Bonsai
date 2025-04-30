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
      assignedTo?: string; // Added: Username or email of the assigned user
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
    assignedTo?: string; // Added: Username or email of the assigned user
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
    const contextPrefix = isProjectChat
      ? "This is a PROJECT CHAT with multiple users. Focus on collaboration, team coordination, and project management. When creating tasks or events, you MUST determine the most appropriate user from the conversation context and assign it to them using the 'assignedTo' field (use their username if known, otherwise email). If no specific user is appropriate or mentioned, you can omit the 'assignedTo' field."
      : "";

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
            {"isTaskPlanning": true, "needsMoreInfo": boolean, "followUpQuestion": "question if more info needed", "taskPlan": {"title": "Main task title", "description": "Overall description", "subtasks": [{"title": "Subtask 1", "description": "Details", "startTime": "ISO", "endTime": "ISO", "priority": 1-10, "assignedTo": "username_or_email"}, ...]}} // Added assignedTo

            Only set needsMoreInfo to true if you don't have essential information like:
            - What the overall task/project is
            - When it needs to be completed by (deadline)
            - Any specific requirements or constraints

            For calendar requests:
            If a user is asking to add one or more events to their calendar, extract the details for each event in the user's local time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}) and respond with JSON in this format:
            {"isCalendarEvent": true, "events": [{"title": "Event title", "description": "Event description", "location": "Event location", "startTime": "ISO string with timezone offset", "endTime": "ISO string with timezone offset", "allowReschedule": boolean, "assignedTo": "username_or_email"}, {...more events if mentioned...}]} // Added assignedTo

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

    // Log the raw response immediately after receiving it
    console.log("Raw AI response received:", aiResponse);

    try {
      let jsonString = aiResponse;

      // 1. Attempt to extract content from the first code block (any language)
      const codeBlockMatch = jsonString.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1].trim();
        console.log("Extracted from code block:", jsonString);
      } else {
        // 2. If no code block, remove [AI_RESPONSE] tags if present (legacy)
        jsonString = jsonString.replace(/\[AI_RESPONSE\]/g, '').trim();
        console.log("After removing [AI_RESPONSE] (if any):", jsonString);
      }

      // 3. Check if the result looks like JSON before trying to parse
      const potentialJson = jsonString.trim();
      if (potentialJson.startsWith('{') || potentialJson.startsWith('[')) {
        console.log("Attempting to parse potential JSON:", potentialJson);

        if (!potentialJson) {
          console.error("Potential JSON string is empty after cleaning, cannot parse.");
          return {
            isCalendarEvent: false,
            response: "I received an empty response after cleaning. Could you try rephrasing?"
          };
        }

        const parsedResponse = JSON.parse(potentialJson);

        // Check for the unexpected array format [ { task: {...} } ]
        if (Array.isArray(parsedResponse) && parsedResponse.length > 0 && parsedResponse[0].task) {
          console.log("Detected array-based task format, converting to standard event format.");
          const events = parsedResponse.map(item => {
            const task = item.task;
            let endTime = task.dueDate || task.endTime;
            let startTime = task.startTime;

            // If only endTime/dueDate is provided, set startTime 1 hour before
            if (endTime && !startTime) {
              try {
                const endMillis = new Date(endTime).getTime();
                startTime = new Date(endMillis - 60 * 60 * 1000).toISOString();
              } catch (dateError) {
                console.error("Error calculating start time from end time:", dateError);
                startTime = endTime; // Fallback if date parsing fails
              }
            } else if (!endTime && startTime) {
              // If only startTime is provided, set endTime 1 hour after
               try {
                const startMillis = new Date(startTime).getTime();
                endTime = new Date(startMillis + 60 * 60 * 1000).toISOString();
              } catch (dateError) {
                console.error("Error calculating end time from start time:", dateError);
                endTime = startTime; // Fallback if date parsing fails
              }
            } else if (!startTime && !endTime) {
                // If neither is provided, maybe default to now + 1 hour?
                // Or handle as an error/unclear request? For now, log and skip time.
                console.warn("Task format missing both startTime and endTime/dueDate");
                const now = new Date();
                startTime = now.toISOString();
                endTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
            }

            return {
              title: task.title || "Untitled Task",
              description: task.description || "",
              location: task.location || "",
              startTime: ensureCorrectTimezone(startTime),
              endTime: ensureCorrectTimezone(endTime),
              allowReschedule: false, // Defaulting to false for tasks
              isTaskPlanEvent: false, // Assuming these are individual tasks/events
              priority: task.priority || 5, // Default priority
              assignedTo: task.assignedTo || undefined
            };
          }).filter(event => event.startTime && event.endTime); // Filter out events where time calculation failed badly

          if (events.length > 0) {
             return {
                isCalendarEvent: true,
                events: events
             };
          } else {
             console.error("Failed to convert any tasks from array format to event format.");
             // Fall through to potentially treat as plain text if conversion fails
          }
        }

        // Handle backward compatibility with the old format (single event)
        if (parsedResponse.isCalendarEvent && parsedResponse.eventDetails) {
          return {
            isCalendarEvent: true,
            events: [parsedResponse.eventDetails]
          };
        }
        return parsedResponse;

      } else {
        // 4. If it doesn't look like JSON, treat it as a plain text response
        console.log("Response doesn't look like JSON, treating as plain text:", aiResponse);
        return {
          isCalendarEvent: false,
          isCalendarSummaryRequest: false,
          isSpecificTimeQuery: false,
          response: aiResponse // Return the original, unparsed response
        };
      }

    } catch (e) {
      // Log the error and the string that failed parsing
      console.error("Failed to parse AI response string:", aiResponse, "Error:", e);
      return {
        isCalendarEvent: false,
        response: "I'm having trouble understanding the structure of that response. Could you try again?"
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
