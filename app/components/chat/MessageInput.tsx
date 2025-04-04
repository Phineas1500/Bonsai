import React from 'react';
import { View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PdfUploader from './PdfUploader';

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPdfSelected: (text: string, filename: string) => void;
  disabled?: boolean;
  onFocus?: () => void;
  uploadedContent?: {text: string, filename: string} | null;
  clearUploadedContent?: () => void;
}

const MessageInput = ({ 
  value, 
  onChangeText, 
  onSend, 
  onPdfSelected,
  disabled, 
  onFocus,
  uploadedContent,
  clearUploadedContent 
}: MessageInputProps) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View className="px-6 translate-y-1">
        {uploadedContent && (
          <View className="flex-row bg-teal-900/30 rounded-t-lg px-4 py-2 items-center border-t border-l border-r border-teal-700/50">
            <Ionicons name={uploadedContent.filename.endsWith('.pdf') ? 
              "document-text" : "image"} 
              size={16} 
              color="#14b8a6" 
            />
            <Text className="text-teal-100 text-sm ml-2 flex-1" numberOfLines={1} ellipsizeMode="middle">
              {uploadedContent.filename}
            </Text>
            <TouchableOpacity onPress={clearUploadedContent} className="ml-2">
              <Ionicons name="close-circle" size={16} color="#14b8a6" />
            </TouchableOpacity>
          </View>
        )}
        
        <View className={`flex-row bg-stone-800 border border-stone-600 ${uploadedContent ? 'rounded-b-lg' : 'rounded-t-lg'} pr-2 pb-12`}>
          <View className="flex-row items-center px-2">
            <PdfUploader 
              onPdfSelected={onPdfSelected} 
              disabled={false}
            />
          </View>
          <TextInput
            className="flex-1 text-white px-2 py-3"
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            multiline
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={disabled && !uploadedContent}
            className={`p-2 rounded-full ${disabled && !uploadedContent ? 'opacity-50' : ''}`}
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