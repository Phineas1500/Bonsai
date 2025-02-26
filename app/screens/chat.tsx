import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import GradientButton from '@components/GradientButton';
import Navbar from '../components/Navbar';
import { useUser } from '../contexts/UserContext';
import axios from 'axios';
import { format, parse, parseISO } from 'date-fns';

// Message type definition
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { userInfo } = useUser();
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Add initial welcome message
  useEffect(() => {
    setMessages([
      {
        id: '1',
        text: "Hi there! I'm your personal assistant. You can ask me to add events to your calendar by saying something like 'Add a meeting with John tomorrow at 2pm'.",
        sender: 'bot',
        timestamp: new Date()
      }
    ]);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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
    if (!message.trim()) return;
    
    const userMessage = {
      id: Date.now().toString(),
      text: message,
      sender: 'user' as const,
      timestamp: new Date()
    };
    
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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-stone-950"
    >
      <Navbar />
      <View className="flex-1 justify-between p-6">
        {/* Messages area */}
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1 mb-4"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View 
              key={msg.id} 
              className={`rounded-lg px-4 py-3 my-1 max-w-[80%] ${
                msg.sender === 'user' 
                  ? 'bg-teal-800 self-end' 
                  : 'bg-stone-800 self-start'
              }`}
            >
              <Text className="text-white">{msg.text}</Text>
              <Text className="text-gray-400 text-xs mt-1 text-right">
                {format(msg.timestamp, 'h:mm a')}
              </Text>
            </View>
          ))}
          {isLoading && (
            <View className="self-start bg-stone-800 rounded-lg px-4 py-3 my-1">
              <ActivityIndicator size="small" color="#14b8a6" />
            </View>
          )}
        </ScrollView>

        {/* Input area */}
        <View className="flex-row items-center gap-2">
          <TextInput
            className="flex-1 bg-stone-800 text-white rounded-lg px-4 py-3"
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <GradientButton
            text="Send"
            onPress={handleSend}
            containerClassName="w-20"
            disabled={isLoading || !message.trim()}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}