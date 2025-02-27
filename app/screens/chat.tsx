import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useState, useEffect, useRef } from 'react';

import Navbar from '@components/Navbar';
import { useUser } from '../contexts/UserContext';
import { createChat, getMessages, getUserChats, sendMessage } from '@components/utils/chatManagement';
import GradientText from '@components/GradientText';
import { auth } from '@/firebaseConfig';

import axios from 'axios';
import { format, parse, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';


// WELCOME OVERLAY COMPONENT
function WelcomeOverlay({ opacity }: { opacity: Animated.Value }) {

  // get current time, and set good morning/afternoon/evening/night
  const currentHour = new Date().getHours();
  let greeting = "Good morning";
  if (currentHour > 12 && currentHour < 18) {
    greeting = "Good afternoon";
  } else if ((currentHour >= 18 && currentHour < 24) || (currentHour >= 0 && currentHour < 4)) {
    greeting = "Good evening";
  }

  return (
    <Animated.View
      style={{
        opacity,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#09090b',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 0,
        padding: 20,
      }}
    >
      <View className="items-center space-y-6">
        <GradientText text={`${greeting},\n${auth.currentUser?.displayName}!`} classStyle="text-center text-4xl font-black" size={[400, 80]} />


        {/* COMMENT OUT BELOW ONCE WE ADD TASKS TO BE VISIBLE HERE */}
        <Text className="text-gray-400 text-center">
          Tap the input box below to start chatting
        </Text>
        <View className="animate-bounce">
          <Ionicons name="chevron-down" size={24} color="#14b8a6" />
        </View>
        {/* */}
      </View>
    </Animated.View>
  );
}


//////////////////////////////////////////////////
// Message type definition
export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
}

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { userInfo } = useUser();
  const scrollViewRef = useRef<ScrollView>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const welcomeOpacity = useRef(new Animated.Value(1)).current;

  //initialize chat
  useEffect(() => {
    initializeChat();
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // initialize chat
  const initializeChat = async () => {
    const userEmail = userInfo?.email || "";
    const userChats = await getUserChats(userEmail);

    if (userChats.length <= 0) {

      //if the user doesn't have a chat, then create one
      const c = await createChat(userEmail);
      setChatId(c);

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
      if (!chatId) {
        console.error("ChatId is null");
        return;
      }
      setChatId(userChats[0].id); //for now, assume only one chat
      const messages = await getMessages(chatId);
      console.log("messages: ", messages);
      setMessages(messages);
    }
  }

  // Function to analyze message with OpenAI
  const analyzeWithOpenAI = async (userMessage: string) => {
    try {
      const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY; // Replace with your API key or use environment variable

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant that can add events to a calendar and answer general questions.

              For calendar requests:
              If a user is asking to add an event to their calendar, extract the time, title, and location in the user's local time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}) and respond with JSON in this format:
              {"isCalendarEvent": true, "eventDetails": {"title": "Event title", "description": "Event description", "location": "Event location", "startTime": "ISO string with timezone offset", "endTime": "ISO string with timezone offset"}}

              Important:
              - When generating timestamps, include the timezone offset in the ISO strings and assume the user is referring to times in their local timezone (${Intl.DateTimeFormat().resolvedOptions().timeZone}).
              - If the user mentions a location (like "at Starbucks" or "in New York"), extract it to the location field. If no location is mentioned, set location to empty string.
              - Keep the title focused on the activity, not the location.

              For all other requests:
              Provide a helpful, informative response to the user's question or comment.
              Format your response as:
              {"isCalendarEvent": false, "response": "Your actual helpful answer addressing the user's question goes here. Be thoughtful and informative."}

              When determining dates and times, assume today is ${new Date().toDateString()} in time zone ${Intl.DateTimeFormat().resolvedOptions().timeZone}.
              Be forgiving with the user's formatting and extract the key details.`
            },
            {
              role: "user",
              content: userMessage
            }
          ],
          temperature: 0.2,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;

      // Parse the JSON response
      try {
        return JSON.parse(aiResponse);
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

  // Function to add event to Google Calendar
  const addToCalendar = async (eventDetails: any) => {
    try {
      if (!userInfo?.calendarAuth?.access_token) {
        return "I need access to your Google Calendar to add events. Please sign in with Google first.";
      }

      // Then use it when adding to calendar
      const event = {
        summary: eventDetails.title,
        description: eventDetails.description || "",
        location: eventDetails.location || "",  // Add location field
        start: {
          dateTime: ensureCorrectTimezone(eventDetails.startTime),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: ensureCorrectTimezone(eventDetails.endTime),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
    }
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
      //TODO: handle showing error with sending a message
      console.log("Error sending message:", error);
    }

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      // Analyze message with OpenAI
      const analysis = await analyzeWithOpenAI(message);

      let responseText = "";

      if (analysis.isCalendarEvent) {
        // User is asking to add a calendar event
        responseText = await addToCalendar(analysis.eventDetails);
      } else {
        // Normal conversation
        responseText = analysis.response;
      }

      // Add bot response to messages
      const botResponse = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: 'bot' as const,
        timestamp: new Date()
      };

      try {
        await sendMessage(chatId, botResponse);
      } catch (error) {
        //TODO: handle showing error with sending a message
        console.log("Error syncing messages with the server:", error);
      }

      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error("Error processing message:", error);

      // Add error message
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error processing your request.",
        sender: 'bot' as const,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-stone-950"
    >
      <Navbar />

      <View className="flex-1 justify-between">
        <View className="flex-1 relative">
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 pb-4 w-full px-6"
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
          onSend={handleSend}
          disabled={isLoading || !message.trim()}
          onFocus={fadeOutWelcome}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// CHAT MESSAGE COMPONENT
interface ChatMessageProps {
  message: Message;
}

function ChatMessage({ message }: ChatMessageProps) {
  const isBot = message.sender === 'bot';

  if (isBot) {
    return (
      <View className="rounded-lg px-4 py-3 my-1 bg-stone-800">
        <Text className="text-white">{message.text}</Text>
        <Text className="text-gray-400 text-xs mt-1 text-right">
          {format(message.timestamp, 'h:mm a')}
        </Text>
      </View>
    );
  }

  return (
    <View className="my-1">
      <View className="absolute top-[2px] -left-[2px] w-full rounded-lg bg-teal-500 h-full" />
        <View className="bg-stone-950 rounded-lg px-4 py-3 border border-teal-500">
          <Text className="text-white">{message.text}</Text>
          <Text className="text-gray-400 text-xs mt-1 text-right">
            {format(message.timestamp, 'h:mm a')}
          </Text>
        </View>
    </View>
  );
}

// CHAT INPUT COMPONENT
interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onFocus?: () => void;
}

function MessageInput({ value, onChangeText, onSend, disabled, onFocus }: MessageInputProps) {
  return (
    <View className="px-6 translate-y-1">
      <View className="flex-row bg-stone-800 border border-stone-600 rounded-t-lg pr-2 pb-12">
        <TextInput
          className="flex-1 text-white px-4 py-3"
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          multiline
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={disabled}
          className={`p-2 rounded-full ${disabled ? 'opacity-50' : ''}`}
        >
          <View className="bg-teal-500 rounded-full p-2">
            <Ionicons name="chevron-up" size={16} color="white" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}