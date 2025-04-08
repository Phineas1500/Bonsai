import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '@/firebaseConfig';
import { useUser } from '@/app/contexts/UserContext';
import { useProjectChat } from '@components/utils/ProjectChatManagement';
import { ChatMessage, MessageInput } from '@components/chat';

export default function ProjectScreen() {
  const { projectId } = useLocalSearchParams();
  const { userInfo } = useUser();
  const currentUserEmail = auth.currentUser?.email || '';
  const scrollViewRef = useRef<ScrollView>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    project,
    messages,
    newMessage,
    setNewMessage,
    loading,
    showMembers,
    sendingMessage,
    handleSendMessage,
    getSenderInitials,
    isOwnMessage,
    toggleMembers,
    isCreator
  } = useProjectChat(projectId as string, currentUserEmail);

  // Go back to social screen
  const handleBack = () => {
    router.back();
  };

  // Handle invite members (placeholder for now)
  const handleInviteMembers = () => {
    // You would implement the invitation UI here
    console.log('Invite members');
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-950">
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-stone-950">
      <StatusBar style="light" />

      {/* Header */}
      <View className="bg-stone-900 border-b border-gray-800 px-4 py-3 flex-row items-center justify-between">
        <TouchableOpacity onPress={handleBack} className="p-1">
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>

        <Text className="text-white text-lg font-bold flex-1 ml-4">{project?.name}</Text>

        <TouchableOpacity onPress={toggleMembers} className="ml-2 p-1">
          <Feather name="users" size={22} color="#14b8a6" />
        </TouchableOpacity>
      </View>

      {/* Members panel (shown when toggled) */}
      {showMembers && (
        <View className="bg-stone-900 p-4 border-b border-gray-800">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-white font-bold text-base">Project Members</Text>
            {isCreator && (
              <TouchableOpacity onPress={handleInviteMembers} className="bg-teal-700 px-3 py-1 rounded-md">
                <Text className="text-white">Invite</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="mb-2">
            <Text className="text-gray-400 text-xs mb-1">Members</Text>
            {project?.members.map((member, index) => (
              <View key={index} className="flex-row items-center py-2 border-b border-gray-800">
                <View className="h-8 w-8 rounded-full bg-teal-800 justify-center items-center mr-2">
                  <Text className="text-white font-bold">{getSenderInitials(member)}</Text>
                </View>
                <Text className="text-white">{member}</Text>
                {member === project.creatorEmail && (
                  <View className="ml-2 bg-teal-900 px-2 py-1 rounded">
                    <Text className="text-teal-400 text-xs">Creator</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {isCreator && project !== null && project?.pendingInvites.length > 0 && (
            <View>
              <Text className="text-gray-400 text-xs mb-1">Pending Invites</Text>
              {project?.pendingInvites.map((invite, index) => (
                <View key={index} className="flex-row items-center py-2 border-b border-gray-800">
                  <View className="h-8 w-8 rounded-full bg-gray-700 justify-center items-center mr-2">
                    <Text className="text-white font-bold">{getSenderInitials(invite)}</Text>
                  </View>
                  <Text className="text-white">{invite}</Text>
                  <Text className="text-gray-500 text-xs ml-2">(pending)</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Chat area with consistent styling from chat.tsx */}
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
              {messages.length === 0 ? (
                <View className="flex-1 justify-center items-center p-4">
                  <Feather name="message-circle" size={40} color="#555" />
                  <Text className="text-gray-500 mt-2 text-center">
                    No messages yet. Start the conversation!
                  </Text>
                </View>
              ) : (
                messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={{
                      id: message.id,
                      text: message.text,
                      sender: message.sender,
                      timestamp: message.timestamp && typeof message.timestamp.toDate === 'function'
                        ? message.timestamp.toDate()
                        : message.timestamp instanceof Date
                          ? message.timestamp
                          : new Date()
                    }}
                    isProjectChat={true}
                    senderInitials={getSenderInitials(message.sender)}
                  />
                ))
              )}

              {sendingMessage && (
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

          {/* Use shared MessageInput component */}
          <MessageInput
            value={newMessage}
            onChangeText={setNewMessage}
            onSend={handleSendMessage}
            disabled={!newMessage.trim()}
            onPdfSelected={() => {}}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
