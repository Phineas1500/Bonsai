import { useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { useUser } from '@/app/contexts/UserContext';
import { analyzeWithAI, formatScheduleForContext, ChatTask, ChatAnalysisResponse } from '@/app/components/utils/chatProcessor';
import axios from 'axios';
import { Timestamp } from 'firebase/firestore';

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
  tasks: ChatTask[];
  refreshTasks: () => Promise<void>;
  isProjectChat?: boolean;
  createMessage: (text: string, sender: string) => msg;
}

export function chatbot<msg extends MessageBase>({
  chatId,
  messages,
  setMessages,
  sendMessage,
  tasks,
  refreshTasks,
  isProjectChat = false,
  createMessage
}: chatbotProps<msg>) {
  const { userInfo } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedContent, setUploadedContent] = useState<{text: string, filename: string} | null>(null);
  const [taskPlanData, setTaskPlanData] = useState<any>(null);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [showEventConfirmation, setShowEventConfirmation] = useState(false);
  const [showTaskPlanConfirmation, setShowTaskPlanConfirmation] = useState(false);
  const [isTaskPlanning, setIsTaskPlanning] = useState(false);
  const [taskPlanContext, setTaskPlanContext] = useState<string>('');

  // Process user message with AI
  const processMessage = useCallback(async (messageText: string) => {
    if (!chatId) return null;

    setIsProcessing(true);

    try {
      // If message has uploaded content
      if (uploadedContent) {
        const contentToAnalyze = messageText.trim()
          ? `Here's my question about this file: ${messageText}\n\nFile content: ${uploadedContent.text}`
          : `Extract any task planning information, calendars, schedules or events from this: ${uploadedContent.text}`;

        return await analyzeWithAI(contentToAnalyze, formatScheduleForContext(tasks), isProjectChat);
      }

      // If we're in task planning mode, add context
      if (isTaskPlanning && taskPlanContext) {
        messageText = `[Task Planning Context: ${taskPlanContext}] User response: ${messageText}`;
      }

      return await analyzeWithAI(messageText, formatScheduleForContext(tasks), isProjectChat);
    } catch (error) {
      console.error("Error processing message:", error);
      return {
        isCalendarEvent: false,
        response: "Sorry, I encountered an error processing your request."
      };
    } finally {
      setIsProcessing(false);
    }
  }, [chatId, uploadedContent, isTaskPlanning, taskPlanContext, tasks, isProjectChat]);

  // Add event to calendar (only for personal chat)
  const addToCalendar = useCallback(async (eventDetails: any) => {
    try {
      if (!userInfo?.calendarAuth?.access_token) {
        return "I need access to your Google Calendar to add events. Please sign in with Google first.";
      }

      // Create calendar event
      const event = {
        summary: eventDetails.title,
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
            priority: eventDetails.priority?.toString() || "5"
          }
        }
      };

      const response = await axios.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        event,
        {
          headers: {
            Authorization: `Bearer ${userInfo.calendarAuth.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200 || response.status === 201) {
        const eventDate = format(parseISO(eventDetails.startTime), 'MMMM do, yyyy');
        const eventTime = format(parseISO(eventDetails.startTime), 'h:mm a');

        return `I've added "${eventDetails.title}" to your calendar on ${eventDate} at ${eventTime}.`;
      } else {
        return "I had trouble adding that to your calendar. Please try again.";
      }
    } catch (error) {
      console.error("Error adding event to calendar:", error);
      return "I couldn't add that to your calendar. There might be an issue with your calendar access.";
    } finally {
      // Refresh tasks to get updated calendar data
      refreshTasks();
    }
  }, [userInfo, refreshTasks]);

  // Helper for ensuring timezone
  const ensureCorrectTimezone = (isoString: string): string => {
    // If the time string already has timezone info, we're good
    if (isoString.includes('+') || isoString.includes('Z')) {
      return isoString;
    }

    // Otherwise, interpret as local time and add timezone info
    const date = new Date(isoString);
    return date.toISOString();
  };

  // Handle sending a message
  const handleSend = useCallback(async (messageText: string) => {
    if ((!messageText.trim() && !uploadedContent) || !chatId) return false;

    // Create and send user message
    const userMessageText = messageText.trim() ||
      (uploadedContent ? `📄 Uploaded: ${uploadedContent.filename}` : '');

    const userMessage = createMessage(userMessageText, userInfo?.email || '');

    try {
      await sendMessage(chatId, userMessage);
      setMessages(prev => [...prev, userMessage]);

      // Process with AI
      const aiResponse = await processMessage(messageText);

      if (!aiResponse) return false;

      // Handle different response types
      if (aiResponse.isTaskPlanning) {
        await handleTaskPlanningResponse(aiResponse);
      } else if (aiResponse.isCalendarEvent && aiResponse.events && aiResponse.events.length > 0) {
        setPendingEvents(aiResponse.events);
        setCurrentEventIndex(0);
        setShowEventConfirmation(true);
      } else {
        // Regular response
        const botMessage = createMessage(
          aiResponse.response || "I don't know how to respond to that.",
          'bot'
        );

        await sendMessage(chatId, botMessage);
        setMessages(prev => [...prev, botMessage]);
      }

      // Clear uploaded content after processing
      setUploadedContent(null);
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  }, [chatId, uploadedContent, userInfo, sendMessage, setMessages, processMessage, createMessage]);

  // Handle task planning response
  const handleTaskPlanningResponse = useCallback(async (aiResponse: ChatAnalysisResponse) => {
    if (!chatId) return;

    if (aiResponse.needsMoreInfo) {
      // Need more information - ask follow-up question
      setIsTaskPlanning(true);
      setTaskPlanContext(aiResponse.followUpQuestion || '');

      const botMessage = createMessage(
        aiResponse.followUpQuestion || "Can you provide more details about your task?",
        'bot'
      );

      await sendMessage(chatId, botMessage);
      setMessages(prev => [...prev, botMessage]);
    } else {
      // Got all information needed for task planning
      setIsTaskPlanning(false);
      setTaskPlanContext('');
      setTaskPlanData(aiResponse.taskPlan);

      // Create a summary of the task plan
      let summaryText = `I've created a plan for "${aiResponse.taskPlan?.title}":\n\n`;

      aiResponse.taskPlan?.subtasks.forEach((subtask, index) => {
        const startDate = format(parseISO(subtask.startTime), 'MMM d, h:mm a');
        summaryText += `${index + 1}. ${subtask.title} (${startDate})\n`;
      });

      summaryText += "\nWould you like me to add these items to your calendar?";

      const botMessage = createMessage(summaryText, 'bot');

      await sendMessage(chatId, botMessage);
      setMessages(prev => [...prev, botMessage]);

      // Show the task plan confirmation modal
      setShowTaskPlanConfirmation(true);
    }
  }, [chatId, sendMessage, setMessages, createMessage]);

  // Handle task plan confirmation
  const handleConfirmTaskPlan = useCallback(() => {
    if (!taskPlanData) return;

    // Convert task plan to pending events format
    setPendingEvents(taskPlanData.subtasks.map((subtask: any) => ({
      title: subtask.title,
      description: `${subtask.description}\n\nPart of task plan: ${taskPlanData.title}`,
      startTime: subtask.startTime,
      endTime: subtask.endTime,
      location: "",
      priority: subtask.priority,
      isTaskPlanEvent: true
    })));

    setCurrentEventIndex(0);
    setShowEventConfirmation(true);
    setShowTaskPlanConfirmation(false);
  }, [taskPlanData]);

  // Handle task plan cancellation
  const handleCancelTaskPlan = useCallback(async () => {
    if (!chatId) return;

    setTaskPlanData(null);
    setShowTaskPlanConfirmation(false);

    // Add response about cancellation
    const botMessage = createMessage(
      "I've cancelled adding the task plan to your calendar.",
      'bot'
    );

    try {
      await sendMessage(chatId, botMessage);
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [chatId, sendMessage, setMessages, createMessage]);

  // Handle event confirmation
  const handleConfirmEvent = useCallback(async () => {
    if (!chatId || pendingEvents.length === 0 || currentEventIndex >= pendingEvents.length) return;

    setIsProcessing(true);
    const currentEvent = pendingEvents[currentEventIndex];

    // For non-project chats, try to add to calendar
    let responseText = isProjectChat
      ? `Added "${currentEvent.title}" to the project calendar.`
      : await addToCalendar(currentEvent);

    // Add bot response about this event being added
    const botMessage = createMessage(responseText, 'bot');

    try {
      await sendMessage(chatId, botMessage);
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
    }

    // Move to next event or finish
    if (currentEventIndex < pendingEvents.length - 1) {
      setCurrentEventIndex(currentEventIndex + 1);
    } else {
      // All events processed
      setShowEventConfirmation(false);
      setPendingEvents([]);
      setCurrentEventIndex(0);
    }

    setIsProcessing(false);
  }, [chatId, pendingEvents, currentEventIndex, isProjectChat, addToCalendar, sendMessage, setMessages, createMessage]);

  // Handle event cancellation
  const handleCancelEvent = useCallback(async () => {
    if (!chatId || pendingEvents.length === 0 || currentEventIndex >= pendingEvents.length) return;

    // Add bot response about cancellation of the current event
    const currentEvent = pendingEvents[currentEventIndex];
    const botMessage = createMessage(
      `I've cancelled adding "${currentEvent.title}" to your calendar.`,
      'bot'
    );

    try {
      await sendMessage(chatId, botMessage);
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
    }

    // Move to next event or finish
    if (currentEventIndex < pendingEvents.length - 1) {
      setCurrentEventIndex(currentEventIndex + 1);
    } else {
      // All events processed or cancelled
      setShowEventConfirmation(false);
      setPendingEvents([]);
      setCurrentEventIndex(0);
    }
  }, [chatId, pendingEvents, currentEventIndex, sendMessage, setMessages, createMessage]);

  return {
    isProcessing,
    uploadedContent,
    setUploadedContent,
    taskPlanData,
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
