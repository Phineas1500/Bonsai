import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { Timestamp } from 'firebase/firestore';

import { useUser } from '@contexts/UserContext';
import AIService from '@contexts/AIService';
import { TaskItemData, useTasks } from '@contexts/TasksContext'; // Import TaskItemData instead of Task
import { getProjectById } from '../utils/projectManagement'; // Import the new function

interface MessageBase {
  id: string;
  text: string;
  sender: string;
  timestamp: Timestamp;
  senderUsername?: string;
}

interface chatbotProps<msg extends MessageBase> {
  chatId: string | null;
  messages: msg[];
  setMessages: React.Dispatch<React.SetStateAction<msg[]>>;
  sendMessage: (chatId: string, message: msg) => Promise<void>;
  tasks: TaskItemData[]; // Use TaskItemData
  refreshTasks: () => Promise<void>;
  isProjectChat?: boolean;
  createMessage: (text: string, sender: string) => msg;
  projectId?: string; // Add optional projectId
}

export function chatbot<msg extends MessageBase>({
  chatId,
  messages,
  setMessages,
  sendMessage,
  tasks, // This is now TaskItemData[]
  refreshTasks,
  isProjectChat = false,
  createMessage,
  projectId // Destructure projectId
}: chatbotProps<msg>) {
  const { userInfo } = useUser();
  const { bonsaiCalendarID } = useTasks();

  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [showEventConfirmation, setShowEventConfirmation] = useState(false);
  const [taskPlanData, setTaskPlanData] = useState<any>(null);
  const [showTaskPlanConfirmation, setShowTaskPlanConfirmation] = useState(false);

  // Ensure correct timezone formatting for Google Calendar API
  const ensureCorrectTimezone = (dateTimeString: string): string => {
    try {
      const date = new Date(dateTimeString);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date string");
      }
      // Format to ISO string which includes timezone offset
      return date.toISOString();
    } catch (error) {
      console.error("Error parsing date string:", dateTimeString, error);
      // Fallback to current time if parsing fails
      return new Date().toISOString();
    }
  };

  // Add event to calendar (now accepts calendarId)
  const addToCalendar = useCallback(async (eventDetails: any, givenCalendarId: string = 'primary') => {
    
    // If the calendarId is primary, use the default Bonsai calendar instead 
    let calendarId = givenCalendarId;
    if (calendarId == 'primary') {
      calendarId = bonsaiCalendarID || 'primary';
    }

    try {
      if (!userInfo?.calendarAuth?.access_token) {
        return "I need access to your Google Calendar to add events. Please sign in with Google first.";
      }

      // Create calendar event
      const event = {
        summary: eventDetails.title, // Use title directly, summary modification happens in handleConfirmEvent
        description: eventDetails.description || "",
        location: eventDetails.location || "",
        start: {
          dateTime: ensureCorrectTimezone(eventDetails.startTime),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: ensureCorrectTimezone(eventDetails.endTime),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        extendedProperties: {
          private: {
            isTaskPlanEvent: eventDetails.isTaskPlanEvent ? 'true' : 'false',
            // Add assignedTo if available, useful for display in calendar details
            ...(eventDetails.assignedTo && { assignedTo: eventDetails.assignedTo })
          }
        }
      };

      // Use the provided calendarId in the API endpoint
      const response = await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        event,
        {
          headers: {
            Authorization: `Bearer ${userInfo.calendarAuth.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        return `I've added "${eventDetails.title}" to your calendar.`;
      } else {
        return `I couldn't add the event. Status: ${response.status}`;
      }
    } catch (error: any) {
      console.error('Error adding event to calendar:', error.response?.data || error.message);
      if (error.response?.status === 401) {
        return "Your Google Calendar access might have expired. Please try signing in with Google again via settings.";
      }
      return `I couldn't add the event due to an error: ${error.message}`;
    } finally {
      // Refresh tasks to get updated calendar data - moved to handleConfirmEvent/handleCancelEvent
      // refreshTasks(); // Removed from here
    }
  }, [userInfo]); // Removed refreshTasks dependency

  // Handle sending message and processing AI response
  const handleSend = useCallback(async (text: string) => {
    if (!chatId) {
      Alert.alert("Error", "Chat ID is missing.");
      return false;
    }

    setIsProcessing(true);
    const userMessage = createMessage(text, userInfo?.email || 'user');

    try {
      // Send user message immediately
      await sendMessage(chatId, userMessage);
      setMessages(prev => [...prev, userMessage]);

      // Get AI response
      const aiService = AIService.getInstance();
      const sessionId = isProjectChat ? `project_${chatId}` : `chat_${chatId}`;

      // Ensure chat session is initialized
      if (!aiService.isSessionActive(sessionId)) {
        // --- MODIFIED SYSTEM PROMPT ---
        const currentUserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const currentUserIdentifier = userInfo?.username || userInfo?.email || 'Unknown'; // Define for clarity
        const systemMessage = `You are Bonsai, an AI assistant integrated into a task management and social app.
        Current User: ${userInfo?.username || 'Unknown'} (Email: ${userInfo?.email || 'Unknown'})
        User's Timezone: ${currentUserTimeZone}
        Today's Date: ${new Date().toLocaleDateString()}

        ${isProjectChat ? `CONTEXT: PROJECT CHAT. Focus on project-related tasks, scheduling, and collaboration. When creating tasks or events, consider assigning them to project members if specified using the 'assignedTo' field (use username or email).` : `CONTEXT: PERSONAL CHAT. Focus on the user's individual tasks and schedule.`}

        FUNCTIONALITY:
        - Analyze user messages for potential calendar events or tasks (e.g., "schedule meeting", "remind me to X", "add task Y").
        - Analyze user messages for task planning requests (e.g., "create a plan for X", "break down project Y").
        - Analyze user messages for task assignment requests (e.g., "I'll do X", "Assign Y to me", "Assign Z to Bob").

        OUTPUT FORMATS (Strictly adhere to one of these):

        1.  **For Events/Tasks:** If one or more events/tasks are detected, respond ONLY with a valid JSON object containing an array named "events".
            \`\`\`json
            {
              "events": [
                {
                  "title": "Event/Task Title",
                  "startTime": "YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss+HH:mm", // REQUIRED: ISO 8601 format in UTC or with timezone offset
                  "endTime": "YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss+HH:mm",   // REQUIRED: ISO 8601 format in UTC or with timezone offset
                  "description": "Optional details",
                  "location": "Optional location",
                  "assignedTo": "username_or_email_or_null" // Optional: Assignee identifier
                }
                // ... more events if applicable
              ]
            }
            \`\`\`
            - **Time Handling:** Interpret user times relative to their timezone (${currentUserTimeZone}). ALWAYS output 'startTime' and 'endTime' in full ISO 8601 format, including timezone offset (e.g., +05:00, -08:00) or 'Z' for UTC.
            - **All-Day Tasks:** For tasks without specific times but a deadline date, use the start of that day for 'startTime' and the end of that day for 'endTime' in the user's timezone, converted to ISO 8601.
            - **Task Assignment (CRITICAL):**
                - If the user explicitly states **they** will perform the task (e.g., "I'll do X", "Assign Y to me", "I can take that", "I will handle Z"), create a single event object for that task and **you MUST set 'assignedTo' to the CURRENT USER'S identifier: '${currentUserIdentifier}'**. Do NOT assign it to anyone else in this specific self-assignment case, regardless of project context.
                - If the user assigns a task to someone else (e.g., "Assign X to Bob", "Can Alice do Y?"), use the specified name or email in the 'assignedTo' field.
                - If no specific person is mentioned for assignment, leave 'assignedTo' as null or omit it.

        2.  **For Task Plans:** If a task plan is requested, respond ONLY with a valid JSON object containing an array named "taskPlan".
            \`\`\`json
            {
              "taskPlan": [
                {
                  "title": "Sub-task Title",
                  "startTime": "YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss+HH:mm", // REQUIRED: ISO 8601 format
                  "endTime": "YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss+HH:mm",   // REQUIRED: ISO 8601 format
                  "description": "Optional details",
                  "location": "Optional location",
                  "assignedTo": "username_or_email_or_null" // Optional: Assignee identifier
                }
                // ... more sub-tasks
              ]
            }
            \`\`\`
            - Follow the same time handling and assignment rules as for events/tasks.

        3.  **For Other Messages:** If NO events, tasks, or task plans are detected, provide a helpful text response. Start these text-only responses with "[AI_RESPONSE]". Example: "[AI_RESPONSE] Okay, I can help with that."

        IMPORTANT:
        - Respond ONLY with the JSON structure OR the "[AI_RESPONSE]" text format. Do not include any other text, explanations, or markdown formatting like \`\`\`json before or after the required output.
        - Use the user's current tasks for context if needed: ${JSON.stringify(tasks)}
        - Be concise and accurate, paying close attention to the assignment rules.`;
        // --- END MODIFIED SYSTEM PROMPT ---
        await aiService.startChat(sessionId, systemMessage);
      }

      const aiResponseText = await aiService.sendMessage(sessionId, text);
      console.log("Raw AI response received:", aiResponseText);

      // --- UPDATED processAIResponseInline ---
      const processAIResponseInline = (responseText: string | null) => {
        if (!responseText) {
          return { textResponse: null, events: null, taskPlan: null };
        }

        let jsonString = responseText.trim();

        // 1. Check for JSON within Markdown code fences (```json ... ``` or ``` ... ```)
        const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonString = codeBlockMatch[1].trim();
          console.log("Extracted JSON from code block:", jsonString);
        } else {
          // 2. If no code block, remove potential legacy tags (optional, but safe)
          jsonString = jsonString.replace(/^\s*\[AI_RESPONSE\]\s*/, '');
          console.log("No code block found, using raw/cleaned string:", jsonString);
        }

        // 3. Attempt to parse the extracted/cleaned string
        // --- ADD THIS CHECK ---
        if (jsonString.startsWith('{') || jsonString.startsWith('[')) {
          // Only attempt to parse if it looks like JSON
          try {
            const parsed = JSON.parse(jsonString);

            // Check the structure of the parsed result
            if (typeof parsed === 'object' && parsed !== null) {
              // A) Standard { events: [...] } format
              if (parsed.events && Array.isArray(parsed.events)) {
                console.log("Parsed as standard events object.");
                return { textResponse: null, events: parsed.events, taskPlan: null };
              }
              // B) Standard { taskPlan: [...] } format
              if (parsed.taskPlan && Array.isArray(parsed.taskPlan)) {
                console.log("Parsed as standard taskPlan object.");
                return { textResponse: null, events: null, taskPlan: parsed.taskPlan };
              }
            }

            // C) Direct array format [...] - assume it's events
            if (Array.isArray(parsed)) {
              console.log("Parsed as direct array of events.");
              return { textResponse: null, events: parsed, taskPlan: null };
            }

            // D) If it parsed but didn't match known structures
            console.warn("Parsed JSON but didn't match expected events/taskPlan/array structure:", parsed);
            return { textResponse: "I received a structured response, but couldn't understand its format.", events: null, taskPlan: null };

          } catch (e) {
            // JSON parsing failed
            if (jsonString) {
              console.error("Failed to parse potential JSON:", jsonString, e);
            }
            // Return a user-friendly error message if parsing fails on likely JSON
            return { textResponse: "Sorry, I couldn't properly understand the structure of the AI's response. Please try rephrasing your request.", events: null, taskPlan: null };
          }
        } else {
           // --- MOVED PLAIN TEXT FALLBACK HERE ---
           // If it doesn't start with { or [, treat as plain text directly
           console.log("Treating as plain text response (doesn't start with { or [):", responseText);
           const cleanedText = (responseText || '').replace(/^\s*\[AI_RESPONSE\]\s*/, '').replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();
           if (cleanedText) {
             return { textResponse: cleanedText, events: null, taskPlan: null };
           } else {
             return { textResponse: null, events: null, taskPlan: null };
           }
           // --- END MOVED FALLBACK ---
        }
      };
      // --- END UPDATED processAIResponseInline ---

      const { textResponse, events, taskPlan } = processAIResponseInline(aiResponseText);
      console.log("Processed AI response:", { textResponse, events, taskPlan });

      if (events && events.length > 0) {
        setPendingEvents(events);
        setCurrentEventIndex(0);
        setShowEventConfirmation(true);
        // Don't send a text message if only events are found
      } else if (taskPlan && taskPlan.length > 0) {
        setTaskPlanData(taskPlan);
        setShowTaskPlanConfirmation(true);
        // Don't send a text message if only a task plan is found
      } else if (textResponse) {
        const botMessage = createMessage(textResponse, 'bot');
        await sendMessage(chatId, botMessage);
        setMessages(prev => [...prev, botMessage]);
      } else {
        // Handle cases where AI gives no actionable response or empty response
        const fallbackMessage = createMessage("I received your message, but I couldn't determine a specific action.", 'bot');
        await sendMessage(chatId, fallbackMessage);
        setMessages(prev => [...prev, fallbackMessage]);
      }
      return true; // Indicate success
    } catch (error: any) {
      console.error("Error in handleSend:", error);
      const errorMessage = createMessage(`Sorry, I encountered an error: ${error.message}`, 'bot');
      try {
        await sendMessage(chatId, errorMessage);
        setMessages(prev => [...prev, errorMessage]);
      } catch (sendError) {
        console.error("Error sending error message:", sendError);
      }
      return false; // Indicate failure
    } finally {
      setIsProcessing(false);
    }
  }, [chatId, userInfo, tasks, sendMessage, setMessages, createMessage, isProjectChat, refreshTasks]);

  // Handle event confirmation
  const handleConfirmEvent = useCallback(async () => {
    if (!chatId || pendingEvents.length === 0 || currentEventIndex >= pendingEvents.length) return;

    setIsProcessing(true);
    const currentEvent = { ...pendingEvents[currentEventIndex] }; // Clone event to modify
    const assignedUser = currentEvent.assignedTo; // This could be username or email
    const currentUserIdentifier = userInfo?.username || userInfo?.email; // Use username first, fallback to email

    let responseText = '';
    let projectData = null;
    let sharedCalendarId: string | undefined | null = null;

    // Fetch project data if in project chat and projectId is available
    if (isProjectChat && projectId) {
      projectData = await getProjectById(projectId);
      sharedCalendarId = projectData?.sharedCalendarId;
      console.log(`Project Chat: Fetched project ${projectId}, Shared Calendar ID: ${sharedCalendarId}`);
    }

    // Determine if the event is assigned to the *current* logged-in user
    const isAssignedToCurrentUser = assignedUser && currentUserIdentifier &&
                                    (assignedUser.toLowerCase() === currentUserIdentifier.toLowerCase() ||
                                     (userInfo?.email && assignedUser.toLowerCase() === userInfo.email.toLowerCase()));

    console.log(`Event: "${currentEvent.title}", AssignedTo: ${assignedUser}, CurrentUser: ${currentUserIdentifier}, IsAssignedToCurrentUser: ${isAssignedToCurrentUser}`);

    if (isAssignedToCurrentUser) {
      // --- Assigned to current user ---
      if (isProjectChat && sharedCalendarId) {
        // Project chat with a shared calendar: Add to shared calendar
        console.log(`Adding event for current user to SHARED calendar: ${sharedCalendarId}`);
        // Modify summary to show assignment clearly in the shared calendar
        currentEvent.summary = `${currentEvent.title} (Assigned: ${userInfo?.username || assignedUser})`;
        responseText = await addToCalendar(currentEvent, sharedCalendarId);
        // Adjust confirmation message for project calendar
        if (responseText.startsWith("I've added")) {
           responseText = `Task "${currentEvent.title}" assigned to you. ${responseText.replace("your calendar", `the project calendar (${projectData?.name})`)}`;
        } else {
           // Provide specific feedback if adding to shared calendar failed
           responseText = `Task "${currentEvent.title}" assigned to you. (Could not add to project calendar: ${responseText})`;
        }
      } else {
        // Personal chat OR project chat without shared calendar: Add to primary
        console.log(`Adding event for current user to PRIMARY calendar`);
        responseText = await addToCalendar(currentEvent); // Uses 'primary' by default
        // Adjust confirmation message based on success/failure and context
        if (responseText.startsWith("I couldn't add") || responseText.startsWith("I need access")) {
           responseText = `Confirmed: "${currentEvent.title}" assigned to you. (Could not add to your primary calendar: ${responseText})`;
        } else if (isProjectChat) {
           // Success in project chat (added to primary)
           responseText = `Task "${currentEvent.title}" assigned to you. ${responseText.replace("your calendar", "your primary calendar")}`;
        } else {
           // Success in personal chat (added to primary) - keep original message like "I've added... to your calendar"
           // responseText remains unchanged
        }
      }
    } else if (assignedUser) {
      // --- Assigned to someone else ---
      responseText = `Task "${currentEvent.title}" assigned to ${assignedUser}.`;
      // If project chat and shared calendar exists, add it anyway but mention assignment
      if (isProjectChat && sharedCalendarId) {
         console.log(`Adding event assigned to OTHER user (${assignedUser}) to SHARED calendar: ${sharedCalendarId}`);
         currentEvent.summary = `${currentEvent.title} (Assigned: ${assignedUser})`;
         // Add to shared calendar without specific confirmation *for the assignee* in this message
         const sharedCalResponse = await addToCalendar(currentEvent, sharedCalendarId);
         if (sharedCalResponse.startsWith("I've added")) {
            responseText += ` Added to project calendar (${projectData?.name}).`;
         } else {
            responseText += ` (Could not add to project calendar: ${sharedCalResponse})`;
         }
      } else {
         console.log(`Event assigned to OTHER user (${assignedUser}), no shared calendar or not project chat. Not adding to any calendar.`);
      }
      // Do not attempt to add to the other user's primary calendar
    } else {
      // --- Not assigned to anyone specific ---
      if (isProjectChat && sharedCalendarId) {
         // Project chat with shared calendar - add unassigned task
         console.log(`Adding UNASSIGNED event to SHARED calendar: ${sharedCalendarId}`);
         responseText = await addToCalendar(currentEvent, sharedCalendarId);
         if (responseText.startsWith("I've added")) {
            responseText = `Added unassigned task "${currentEvent.title}" to the project calendar (${projectData?.name}).`;
         } else {
            responseText = `Added unassigned task "${currentEvent.title}" to the project plan. (Could not add to project calendar: ${responseText})`;
         }
      } else if (!isProjectChat) {
         // Personal chat - add unassigned task to primary
         console.log(`Adding UNASSIGNED event to PRIMARY calendar`);
         responseText = await addToCalendar(currentEvent);
         // Keep original confirmation message
      } else {
         // Project chat without shared calendar - just confirm it's noted
         console.log(`UNASSIGNED event in project chat without shared calendar. Not adding to any calendar.`);
         responseText = `Added unassigned task "${currentEvent.title}" to the project plan/schedule.`;
      }
    }

    // Add bot response message
    const botMessage = createMessage(responseText, 'bot');

    try {
      await sendMessage(chatId, botMessage);
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending confirmation/assignment message:", error);
    }

    // Move to next event or finish
    if (currentEventIndex < pendingEvents.length - 1) {
      setCurrentEventIndex(currentEventIndex + 1);
      // Keep confirmation modal open for the next event
      setIsProcessing(false); // Allow interaction for the next confirmation
    } else {
      // All events processed
      setShowEventConfirmation(false);
      setPendingEvents([]);
      setCurrentEventIndex(0);
      // Refresh tasks *after* all events are processed
      console.log("All events processed, refreshing tasks...");
      refreshTasks();
      setIsProcessing(false); // Final processing finished
    }

  }, [chatId, projectId, isProjectChat, pendingEvents, currentEventIndex, userInfo, addToCalendar, sendMessage, setMessages, createMessage, refreshTasks]);


  // Handle event cancellation
  const handleCancelEvent = useCallback(async () => {
    if (!chatId || pendingEvents.length === 0 || currentEventIndex >= pendingEvents.length) return;

    const cancelledEvent = pendingEvents[currentEventIndex];
    const responseText = `Okay, I won't add "${cancelledEvent.title}" to the calendar.`;
    const botMessage = createMessage(responseText, 'bot');

    try {
      await sendMessage(chatId, botMessage);
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending cancellation message:", error);
    }

    // Move to next event or finish
    if (currentEventIndex < pendingEvents.length - 1) {
      setCurrentEventIndex(currentEventIndex + 1);
      // Keep modal open for next event
    } else {
      // All events processed (or cancelled)
      setShowEventConfirmation(false);
      setPendingEvents([]);
      setCurrentEventIndex(0);
      // No need to refresh tasks if all were cancelled
    }
  }, [chatId, pendingEvents, currentEventIndex, sendMessage, setMessages, createMessage]);

  // Handle task plan confirmation
  const handleConfirmTaskPlan = useCallback(async () => {
    if (!chatId || !taskPlanData) return;

    setIsProcessing(true);
    setShowTaskPlanConfirmation(false); // Close confirmation modal

    // Convert task plan items to event-like objects for potential calendar adding
    const eventsFromPlan = taskPlanData.map((task: any) => ({
      ...task,
      isTaskPlanEvent: true // Mark these as originating from a task plan
    }));

    // Set these as pending events to go through the confirmation flow
    setPendingEvents(eventsFromPlan);
    setCurrentEventIndex(0);
    setShowEventConfirmation(true); // Show event confirmation for the first task in the plan

    // Send a message indicating the plan is being processed
    const planMessage = createMessage("Okay, let's confirm the tasks from the plan.", 'bot');
    try {
      await sendMessage(chatId, planMessage);
      setMessages(prev => [...prev, planMessage]);
    } catch (error) {
      console.error("Error sending task plan processing message:", error);
    }

    // No need to set isProcessing false here, as handleConfirmEvent will manage it
    // setTaskPlanData(null); // Clear task plan data now handled by pendingEvents
  }, [chatId, taskPlanData, sendMessage, setMessages, createMessage]);

  // Handle task plan cancellation
  const handleCancelTaskPlan = useCallback(async () => {
    if (!chatId) return;

    const responseText = "Okay, I've cancelled the task plan.";
    const botMessage = createMessage(responseText, 'bot');

    try {
      await sendMessage(chatId, botMessage);
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending task plan cancellation message:", error);
    }

    setShowTaskPlanConfirmation(false);
    setTaskPlanData(null);
  }, [chatId, sendMessage, setMessages, createMessage]);


  return {
    isProcessing,
    taskPlanData, // Keep this to pass to the modal
    pendingEvents,
    currentEventIndex,
    showEventConfirmation,
    showTaskPlanConfirmation,
    handleSend,
    handleConfirmTaskPlan,
    handleCancelTaskPlan,
    handleConfirmEvent,
    handleCancelEvent
  };
}
