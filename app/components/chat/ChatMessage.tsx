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
}

const ChatMessage = ({ message }: ChatMessageProps) => {
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
};

export default ChatMessage;
