import React from 'react';
import { View, Text, Image } from 'react-native';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { useUser } from '@contexts/UserContext';


export interface Message {
  id: string;
  text: string;
  sender: string;
  senderUsername: string;
  timestamp: Timestamp;
}

interface ChatMessageProps {
  message: Message;
  isProjectChat?: boolean;
}

// Helper function to safely format timestamps
const formatTimestamp = (timestamp: Timestamp): string => {
  try {
    if (!timestamp) return '';

    // Handle Firestore Timestamp
    if (timestamp instanceof Timestamp && typeof timestamp.toDate === 'function') {
      return format(timestamp.toDate(), 'h:mm a');
    }

    // Handle Date objects
    if (timestamp instanceof Date) {
      return format(timestamp, 'h:mm a');
    }

    // If somehow timestamp is a number or string, try to convert it
    if (typeof timestamp === 'number' || typeof timestamp === 'string') {
      return format(new Date(timestamp), 'h:mm a');
    }

    return '';
  } catch (error) {
    console.warn('Error formatting timestamp:', error);
    return '';
  }
};

const ChatMessage = ({ message, isProjectChat = false }: ChatMessageProps) => {
  const { userInfo } = useUser();

  const isBot = message.sender === 'bot';
  const isSelf = message.sender === userInfo?.email;

  // Extract username for avatar generation
  let avatarUrl = '';
  if (isBot) {
    avatarUrl = Image.resolveAssetSource(require('@assets/images/bonsai-logo.png')).uri;
  } else {
    const seed = encodeURIComponent(message.senderUsername);
    avatarUrl = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${seed}`;
  }

  if (isBot || !isSelf) {
    return (
      <View className="flex-row my-1">
        {isProjectChat && (
          <Image
            source={{ uri: avatarUrl }}
            className="h-9 w-9 rounded-full mr-2"
          />
        )}
        <View className="flex-1">
          {isProjectChat && (
            <Text className="text-gray-400 text-xs ml-1 mb-1">
              {message.senderUsername}
            </Text>
          )}
          <View className="rounded-lg px-4 py-3 my-1 bg-stone-800">
            <Text className="text-white">{message.text}</Text>
            <Text className="text-gray-400 text-xs mt-1 text-right">
              {formatTimestamp(message.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // User message styling
  return (
    <View className="flex-row my-1 justify-end">
      <View className="my-1 max-w-[80%]">
        <View className="absolute top-[2px] -left-[2px] w-full rounded-lg bg-teal-500 h-full" />
        <View className="bg-stone-950 rounded-lg px-4 py-3 border border-teal-500">
          <Text className="text-white">{message.text}</Text>
          <Text className="text-gray-400 text-xs mt-1 text-right">
            {formatTimestamp(message.timestamp)}
          </Text>
        </View>
      </View>

      {isProjectChat && (
        <Image
          source={{ uri: avatarUrl }}
          className="h-9 w-9 rounded-full ml-2"
        />
      )}
    </View>
  );
};

export default ChatMessage;
