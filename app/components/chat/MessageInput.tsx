import React from 'react';
import { View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onFocus?: () => void;
}

const MessageInput = ({ value, onChangeText, onSend, disabled, onFocus }: MessageInputProps) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100} // Adjust this value as needed
    >
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
    </KeyboardAvoidingView>
  );
};

export default MessageInput;