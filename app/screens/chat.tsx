import { View, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Animated } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { useUser } from '@contexts/UserContext';
import { createChat, getMessages, getUserChats, sendMessage } from '@components/utils/chatManagement';
import { ChatMessage, MessageInput, WelcomeOverlay, Message, EventConfirmationModal } from '@components/chat';
import TaskPlanConfirmationModal from '@components/chat/TaskPlanConfirmationModal';
import { useTasks } from '@contexts/TasksContext';
import { updateUserStreak } from '@components/utils/userManagement';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { userInfo } = useUser();
  const scrollViewRef = useRef<ScrollView>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  const [showEventConfirmation, setShowEventConfirmation] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<any>(null);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const { tasks, refreshTasks } = useTasks();
  const [dailyStreakCheckIn, setDailyStreakCheckIn] = useState(false);
  const [isTaskPlanning, setIsTaskPlanning] = useState(false);
  const [taskPlanContext, setTaskPlanContext] = useState<string>('');
  const [taskPlanData, setTaskPlanData] = useState<any>(null);
  const [showTaskPlanConfirmation, setShowTaskPlanConfirmation] = useState(false);

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 250);
    }
  };

  //initialize chat
  useEffect(() => {
    const loadData = async () => {
      await refreshTasks(); // Make sure schedule data is fresh
      await initializeChat();
    };
    
    loadData();
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // initialize chat
  const initializeChat = async () => {
    const userEmail = userInfo?.email;
    if (!userEmail) {
      // console.error("Unable to get user email. Value:", userEmail);
      console.log("User info:", userInfo);
      return;
    }
    const userChats = await getUserChats(userEmail);

    if (userChats.length <= 0) {
      //if the user doesn't have a chat, then create one
      const c = await createChat(userEmail);
      setChatId(c);
      console.log("No chats found for user. Created chat with id: ", c);

      if (!chatId) {
        //TODO: handle showing error
        return;
      }

      let firstMessage: Message =
      {
        id: '1',
        text: "Hi there! I'm your personal assistant. You can ask me to add events to your calendar by saying something like 'Add a meeting with John tomorrow at 2pm'.",
        sender: 'bot',
        timestamp: new Date()
      };
      await sendMessage(chatId, firstMessage);
      setMessages([firstMessage]);
    } else {
      //if the user has a chat, then load messages from it
      const chatId = userChats[0].id;
      //console.log("All chats for user:", userChats);
      //console.log("Chat ID:", chatId);
      if (!chatId) {
        console.error("ChatId is null");
        return;
      }
      setChatId(userChats[0].id); //for now, assume only one chat
      const messages = await getMessages(chatId);
      //console.log("messages: ", messages);
      setMessages(messages);
    }
  }

  // Function to analyze message with OpenAI
  const analyzeWithOpenAI = async (userMessage: string) => {
    try {
      // Format schedule data for context
      const scheduleContext = formatScheduleForContext();
      
      const sys_message = `You are a helpful assistant that can add events to a calendar and answer general questions.

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
              {"isCalendarEvent": true, "events": [{"title": "Event title", "description": "Event description", "location": "Event location", "startTime": "ISO string with timezone offset", "endTime": "ISO string with timezone offset"}, {...more events if mentioned...}]}

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

              Remember, keep your response as a valid JSON format. Do not prepend your response with backticks.`

      const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not defined');
      }
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = await genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const generationConfig = {
        temperature: 0.2,
        maxOutputTokens: 2048,
      }

      const chat = model.startChat({
        generationConfig,
        systemInstruction: {
          role: 'system',
          parts: [{text: sys_message}],
        },
      });

      const result = await chat.sendMessage(userMessage);
      let aiResponse = result.response.text();

      // Parse the JSON response
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
        console.error("Failed to parse OpenAI response:", aiResponse);
        return { isCalendarEvent: false, response: "I'm having trouble understanding that. Could you try again?" };
      }
    } catch (error) {
      console.error("OpenAI API error:", error);
      return { isCalendarEvent: false, response: "Sorry, I encountered an error processing your request." };
    }
  };

  // Add this function to ensure times are properly converted
  const ensureCorrectTimezone = (isoString: string): string => {
    // If the time string already has timezone info, we're good
    if (isoString.includes('+') || isoString.includes('Z')) {
      return isoString;
    }

    // Otherwise, interpret as local time and add timezone info
    const date = new Date(isoString);
    return date.toISOString();
  };

  // Update the formatScheduleForContext function to include human-readable dates
  const formatScheduleForContext = () => {
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

  // Function to add event to Google Calendar
  const addToCalendar = async (eventDetails: any) => {
    try {
      if (!userInfo?.calendarAuth?.access_token) {
        return "I need access to your Google Calendar to add events. Please sign in with Google first.";
      }

      // Create event object with task plan metadata if present
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
        // Add extended properties for task plan metadata
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
        
        // Different message for task plan events
        if (eventDetails.isTaskPlanEvent) {
          return `I've added the task "${eventDetails.title}" to your calendar on ${eventDate} at ${eventTime}.`;
        } else {
          return `I've added "${eventDetails.title}" to your calendar on ${eventDate} at ${eventTime}.`;
        }
      } else {
        return "I had trouble adding that to your calendar. Please try again.";
      }
    } catch (error) {
      console.error("Error adding event to calendar:", error);
      return "I couldn't add that to your calendar. There might be an issue with your calendar access.";
    }
  };

  // Function to format calendar events
  const getCalendarSummary = async () => {
    // Refresh the tasks to get the latest data
    await refreshTasks();

    if (tasks.length === 0) {
      return "You don't have any upcoming events on your calendar.";
    }

    // Format the upcoming events in a nice message
    let summaryText = "Here's your upcoming schedule:\n\n";

    // Group events by date
    const eventsByDate = tasks.reduce((acc, task) => {
      const date = format(parseISO(task.startTime), 'EEEE, MMMM d');
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(task);
      return acc;
    }, {} as Record<string, typeof tasks>);

    // Sort tasks by priority within each date
    Object.keys(eventsByDate).forEach(date => {
      eventsByDate[date].sort((a, b) => b.priority - a.priority);
    });

    // Format each date's events
    Object.entries(eventsByDate).forEach(([date, dateEvents], index) => {
      if (index > 0) summaryText += "\n";
      summaryText += `${date}:\n`;

      dateEvents.forEach(event => {
        const startTime = format(parseISO(event.startTime), 'h:mm a');
        const endTime = format(parseISO(event.endTime), 'h:mm a');
        const priorityIndicator = event.priority >= 8 ? "⚠️ " : 
                                 event.priority >= 6 ? "⚡ " : "";
        
        summaryText += `• ${priorityIndicator}${startTime} - ${endTime}: ${event.title}`;

        if (event.location && typeof event.location === 'string' && event.location.trim() !== '') {
          summaryText += ` (at ${event.location})`;
        }

        summaryText += "\n";
      });
    });

    return summaryText;
  };

  // Add this function after getCalendarSummary
  const getSpecificTimeEvents = (timePeriod: string) => {
    if (tasks.length === 0) {
      return "You don't have any events scheduled for that time period.";
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowDate = new Date(today);
    tomorrowDate.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
    
    // Filter tasks based on the requested time period
    let filteredTasks = [...tasks];
    let periodName = "";

    switch(timePeriod.toLowerCase()) {
      case 'today':
        filteredTasks = tasks.filter(task => task.startTime.startsWith(todayStr));
        periodName = "today";
        break;
      case 'tomorrow':
        filteredTasks = tasks.filter(task => task.startTime.startsWith(tomorrowStr));
        periodName = "tomorrow";
        break;
      case 'this weekend':
        // Get next Saturday and Sunday
        const saturday = new Date(today);
        saturday.setDate(today.getDate() + (6 - today.getDay()));
        const sunday = new Date(saturday);
        sunday.setDate(saturday.getDate() + 1);
        
        const saturdayStr = saturday.toISOString().split('T')[0];
        const sundayStr = sunday.toISOString().split('T')[0];
        
        filteredTasks = tasks.filter(task => 
          task.startTime.startsWith(saturdayStr) || task.startTime.startsWith(sundayStr)
        );
        periodName = "this weekend";
        break;
      // You can add more time periods as needed
      default:
        // Try to parse the time period as a specific date
        try {
          const specificDate = new Date(timePeriod);
          if (!isNaN(specificDate.getTime())) {
            const specificDateStr = specificDate.toISOString().split('T')[0];
            filteredTasks = tasks.filter(task => task.startTime.startsWith(specificDateStr));
            periodName = format(specificDate, 'EEEE, MMMM d');
          }
        } catch(e) {
          // If we can't parse it, just use the original time period
          periodName = timePeriod;
        }
    }

    if (filteredTasks.length === 0) {
      return `You don't have any events scheduled for ${periodName}.`;
    }

    // Sort by start time
    filteredTasks.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    let summaryText = `Here's what you have scheduled for ${periodName}:\n\n`;

    filteredTasks.forEach(event => {
      const startTime = format(parseISO(event.startTime), 'h:mm a');
      const endTime = format(parseISO(event.endTime), 'h:mm a');
      const priorityIndicator = event.priority >= 8 ? "⚠️ " : 
                               event.priority >= 6 ? "⚡ " : "";
      
      summaryText += `• ${priorityIndicator}${startTime} - ${endTime}: ${event.title}`;

      if (event.location && typeof event.location === 'string' && event.location.trim() !== '') {
        summaryText += ` (at ${event.location})`;
      }

      summaryText += "\n";
    });

    return summaryText;
  };

  // Handle sending a message
  const handleSend = async () => {
    if (!message.trim() || !chatId) return;

    const userMessage = {
      id: Date.now().toString(),
      text: message,
      sender: userInfo?.email || "",
      timestamp: new Date(),
    };

    try {
      await sendMessage(chatId, userMessage);
    } catch (error) {
      console.log("Error sending message:", error);
    }

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      // If we're in the middle of task planning, add context to the message
      let messageToAnalyze = message;
      if (isTaskPlanning && taskPlanContext) {
        messageToAnalyze = `[Task Planning Context: ${taskPlanContext}] User response: ${message}`;
      }
      
      const analysis = await analyzeWithOpenAI(messageToAnalyze);

      // Handle task planning responses
      if (analysis.isTaskPlanning) {
        setIsTaskPlanning(true);
        
        if (analysis.needsMoreInfo) {
          // Need more information - ask follow-up question
          setTaskPlanContext(analysis.followUpQuestion);
          
          const botResponse = {
            id: (Date.now() + 1).toString(),
            text: analysis.followUpQuestion,
            sender: 'bot' as const,
            timestamp: new Date()
          };

          try {
            await sendMessage(chatId, botResponse);
          } catch (error) {
            console.log("Error syncing messages with the server:", error);
          }

          setMessages(prev => [...prev, botResponse]);
        } else {
          // Got all information needed for task planning
          setIsTaskPlanning(false);
          setTaskPlanContext('');
          setTaskPlanData(analysis.taskPlan);
          
          // Create a summary of the task plan
          let summaryText = `I've created a plan for "${analysis.taskPlan.title}":\n\n`;
          
          analysis.taskPlan.subtasks.forEach((subtask: any, index: number) => {
            const startDate = format(parseISO(subtask.startTime), 'MMM d, h:mm a');
            summaryText += `${index + 1}. ${subtask.title} (${startDate})\n`;
          });
          
          summaryText += "\nWould you like me to add these items to your calendar?";
          
          const botResponse = {
            id: (Date.now() + 1).toString(),
            text: summaryText,
            sender: 'bot' as const,
            timestamp: new Date()
          };

          try {
            await sendMessage(chatId, botResponse);
          } catch (error) {
            console.log("Error syncing messages with the server:", error);
          }

          setMessages(prev => [...prev, botResponse]);
          
          // Show the task plan confirmation modal
          setShowTaskPlanConfirmation(true);
        }
        
        setIsLoading(false);
        return;
      }
      
      // Handle regular "yes" responses to task plan suggestions
      if (isTaskPlanning && taskPlanData && 
          (message.toLowerCase().includes('yes') || 
           message.toLowerCase().includes('add') || 
           message.toLowerCase().includes('ok'))) {
        // User wants to add the task plan to calendar
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
        setIsTaskPlanning(false);
        setTaskPlanContext('');
        
        const botResponse = {
          id: (Date.now() + 1).toString(),
          text: "Great! I'll add these tasks to your calendar. Please confirm each one.",
          sender: 'bot' as const,
          timestamp: new Date()
        };
        
        try {
          await sendMessage(chatId, botResponse);
        } catch (error) {
          console.log("Error syncing messages with the server:", error);
        }
        
        setMessages(prev => [...prev, botResponse]);
        setIsLoading(false);
        return;
      }
      
      // Handle existing calendar event analysis
      if (analysis.isCalendarEvent && analysis.events && analysis.events.length > 0) {
        // Existing handling for calendar events
        setPendingEvents(analysis.events);
        setCurrentEventIndex(0);
        setShowEventConfirmation(true);
        setIsLoading(false);
      }
      else if (analysis.isCalendarSummaryRequest) {
        // Existing handling for calendar summary
        const summaryText = await getCalendarSummary();

        const botResponse = {
          id: (Date.now() + 1).toString(),
          text: summaryText,
          sender: 'bot' as const,
          timestamp: new Date()
        };

        try {
          await sendMessage(chatId, botResponse);
        } catch (error) {
          console.log("Error syncing messages with the server:", error);
        }

        setMessages(prev => [...prev, botResponse]);
        setIsLoading(false);
      }
      else if (analysis.isSpecificTimeQuery) {
        // Existing handling for time-specific queries
        const summaryText = getSpecificTimeEvents(analysis.timePeriod);
        
        const botResponse = {
          id: (Date.now() + 1).toString(),
          text: analysis.response || summaryText,
          sender: 'bot' as const,
          timestamp: new Date()
        };

        try {
          await sendMessage(chatId, botResponse);
        } catch (error) {
          console.log("Error syncing messages with the server:", error);
        }

        setMessages(prev => [...prev, botResponse]);
        setIsLoading(false);
      } else {
        // Normal conversation flow
        const responseText = analysis.response;

        const botResponse = {
          id: (Date.now() + 1).toString(),
          text: responseText,
          sender: 'bot' as const,
          timestamp: new Date()
        };

        try {
          await sendMessage(chatId, botResponse);
        } catch (error) {
          console.log("Error syncing messages with the server:", error);
        }

        setMessages(prev => [...prev, botResponse]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error processing message:", error);

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error processing your request.",
        sender: 'bot' as const,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const handleDailyChatbotCheckIn = async () => {
    // Chatbot check in complete, update streak if applicable
    // (check dailyStreakCheckIn so updateUserStreak doesn't run every time a message is sent)
    if (!dailyStreakCheckIn) {
      if (userInfo) {
        const checkedIn = await updateUserStreak(userInfo.email);
        setDailyStreakCheckIn(checkedIn);
      }
      else {
        console.log("Couldn't get userInfo, streak not updated");
      }
    }
  }

  const handleConfirmEvent = async () => {
    if (pendingEvents.length === 0 || currentEventIndex >= pendingEvents.length) return;

    setIsLoading(true);
    const currentEvent = pendingEvents[currentEventIndex];
    const responseText = await addToCalendar(currentEvent);

    // Add bot response about this event being added
    const botResponse = {
      id: Date.now().toString(),
      text: responseText,
      sender: 'bot',
      timestamp: new Date()
    };

    try {
      await sendMessage(chatId!, botResponse);
    } catch (error) {
      console.log("Error syncing messages with the server:", error);
    }

    setMessages(prev => [...prev, botResponse]);

    // Move to next event or finish
    if (currentEventIndex < pendingEvents.length - 1) {
      setCurrentEventIndex(currentEventIndex + 1);
    } else {
      // All events processed
      setShowEventConfirmation(false);
      setPendingEvents([]);
      setCurrentEventIndex(0);
    }

    setIsLoading(false);
  };

  const handleCancelEvent = () => {
    if (pendingEvents.length === 0 || currentEventIndex >= pendingEvents.length) return;

    // Add bot response about cancellation of the current event
    const currentEvent = pendingEvents[currentEventIndex];
    const botResponse = {
      id: Date.now().toString(),
      text: `I've cancelled adding "${currentEvent.title}" to your calendar.`,
      sender: 'bot',
      timestamp: new Date()
    };

    try {
      sendMessage(chatId!, botResponse);
    } catch (error) {
      console.log("Error syncing messages with the server:", error);
    }

    setMessages(prev => [...prev, botResponse]);

    // Move to next event or finish
    if (currentEventIndex < pendingEvents.length - 1) {
      setCurrentEventIndex(currentEventIndex + 1);
    } else {
      // All events processed or cancelled
      setShowEventConfirmation(false);
      setPendingEvents([]);
      setCurrentEventIndex(0);
    }
  };

  const fadeOutWelcome = () => {
    if (showWelcome) {
      Animated.timing(welcomeOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setShowWelcome(false));
    }
  };

  // Update the handlePdfSelected function
  const handlePdfSelected = async (pdfText: string, filename: string) => {
    if (!chatId) return;

    setIsLoading(true);

    // Create a message to show the user what PDF was uploaded
    const userMessage = {
      id: Date.now().toString(),
      text: `📄 Uploaded PDF: ${filename}`,
      sender: userInfo?.email || "",
      timestamp: new Date(),
    };

    try {
      await sendMessage(chatId, userMessage);
    } catch (error) {
      console.log("Error sending message:", error);
    }

    setMessages(prev => [...prev, userMessage]);

    try {
      // Analyze the PDF content with AI
      const analysis = await analyzeWithOpenAI(
        `Extract any task planning information, calendars, schedules or events from this PDF: ${pdfText}`
      );

      // Handle task planning content in PDFs
      if (analysis.isTaskPlanning) {
        setTaskPlanData(analysis.taskPlan);
        
        // Create a summary of the task plan
        let summaryText = `I found a task plan in your PDF for "${analysis.taskPlan.title}":\n\n`;
        
        analysis.taskPlan.subtasks.forEach((subtask: any, index: number) => {
          const startDate = format(parseISO(subtask.startTime), 'MMM d, h:mm a');
          summaryText += `${index + 1}. ${subtask.title} (${startDate})\n`;
        });
        
        summaryText += "\nWould you like me to add these items to your calendar?";
        
        const botResponse = {
          id: (Date.now() + 1).toString(),
          text: summaryText,
          sender: 'bot',
          timestamp: new Date()
        };

        try {
          await sendMessage(chatId, botResponse);
        } catch (error) {
          console.log("Error syncing messages with the server:", error);
        }

        setMessages(prev => [...prev, botResponse]);
        setShowTaskPlanConfirmation(true);
      } 
      // Process other types of responses as before
      else if (analysis.isCalendarEvent && analysis.events && analysis.events.length > 0) {
        // Existing code for handling calendar events
        setPendingEvents(analysis.events);
        setCurrentEventIndex(0);
        setShowEventConfirmation(true);
      } else if (analysis.isCalendarSummaryRequest) {
        const summaryText = await getCalendarSummary();

        const botResponse = {
          id: (Date.now() + 1).toString(),
          text: summaryText,
          sender: 'bot',
          timestamp: new Date()
        };

        try {
          await sendMessage(chatId, botResponse);
        } catch (error) {
          console.log("Error syncing messages with the server:", error);
        }

        setMessages(prev => [...prev, botResponse]);
      } else {
        const responseText = analysis.response;

        const botResponse = {
          id: (Date.now() + 1).toString(),
          text: responseText,
          sender: 'bot',
          timestamp: new Date()
        };

        try {
          await sendMessage(chatId, botResponse);
        } catch (error) {
          console.log("Error syncing messages with the server:", error);
        }

        setMessages(prev => [...prev, botResponse]);
      }
    } catch (error) {
      console.error("Error processing PDF:", error);

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error processing your PDF.",
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmTaskPlan = () => {
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
  };

  const handleCancelTaskPlan = () => {
    setTaskPlanData(null);
    setShowTaskPlanConfirmation(false);
    
    // Add response about cancellation
    const botResponse = {
      id: Date.now().toString(),
      text: "I've cancelled adding the task plan to your calendar.",
      sender: 'bot',
      timestamp: new Date()
    };
    
    try {
      sendMessage(chatId!, botResponse);
    } catch (error) {
      console.log("Error syncing messages with the server:", error);
    }
    
    setMessages(prev => [...prev, botResponse]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-stone-950"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View className="flex-1 justify-between">
        <View className="flex-1 relative">
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 pt-10 pb-4 w-full px-6"
            contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <View className="bg-stone-800 rounded-lg px-4 py-3 my-1">
                <ActivityIndicator size="small" color="#14b8a6" />
              </View>
            )}
          </ScrollView>
          <LinearGradient
            colors={['#09090b', 'transparent']}
            className="absolute top-0 left-0 right-0 h-20 z-10 pointer-events-none"
          />
        </View>

        {showWelcome && <WelcomeOverlay opacity={welcomeOpacity} />}

        <MessageInput
          value={message}
          onChangeText={setMessage}
          onSend={() => {
            handleSend();
            handleDailyChatbotCheckIn();
          }}
          onPdfSelected={handlePdfSelected}
          disabled={isLoading || !message.trim()}
          onFocus={() => {
            fadeOutWelcome();
            scrollToBottom();
          }}
        />
      </View>
      {pendingEvents.length > 0 && currentEventIndex < pendingEvents.length && (
        <EventConfirmationModal
          visible={showEventConfirmation}
          eventDetails={pendingEvents[currentEventIndex]}
          onConfirm={handleConfirmEvent}
          onCancel={handleCancelEvent}
          eventCount={pendingEvents.length}
          currentEventIndex={currentEventIndex}
          isTaskPlanEvent={pendingEvents[currentEventIndex]?.isTaskPlanEvent || false}
        />
      )}
      {taskPlanData && (
        <TaskPlanConfirmationModal
          visible={showTaskPlanConfirmation}
          taskPlan={taskPlanData}
          onConfirm={handleConfirmTaskPlan}
          onCancel={handleCancelTaskPlan}
        />
      )}
    </KeyboardAvoidingView>
  );
}