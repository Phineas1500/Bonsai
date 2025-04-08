import React from 'react';
import { View, Text } from 'react-native';
import { format } from 'date-fns';

export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  isProjectChat?: boolean;
  senderInitials?: string;
}

const ChatMessage = ({ message, isProjectChat = false, senderInitials }: ChatMessageProps) => {
  const isBot = message.sender === 'bot';
  const isOwnMessage = isProjectChat ? false : !isBot;

  if (isBot || (isProjectChat && !isOwnMessage)) {
    return (
      <View className="flex-row my-1">
        {isProjectChat && senderInitials && (
          <View className="h-8 w-8 rounded-full bg-teal-800 justify-center items-center mr-2">
            <Text className="text-white font-bold">{senderInitials}</Text>
          </View>
        )}
        <View className="flex-1">
          {isProjectChat && (
            <Text className="text-gray-400 text-xs ml-1 mb-1">
              {message.sender.split('@')[0]}
            </Text>
          )}
          <View className="rounded-lg px-4 py-3 my-1 bg-stone-800">
            <Text className="text-white">{message.text}</Text>
            <Text className="text-gray-400 text-xs mt-1 text-right">
              {format(message.timestamp, 'h:mm a')}
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
            {format(message.timestamp, 'h:mm a')}
          </Text>
        </View>
      </View>

      {isProjectChat && senderInitials && (
        <View className="h-8 w-8 rounded-full bg-teal-700 justify-center items-center ml-2">
          <Text className="text-white font-bold">{senderInitials}</Text>
        </View>
      )}
    </View>
  );
};

export default ChatMessage;
