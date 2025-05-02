import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  Image,
  Alert
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';

import { auth } from '@/firebaseConfig';
import { Timestamp } from 'firebase/firestore';

import { useUser } from '@contexts/UserContext';
import { useProjectChat } from '@components/utils/ProjectChatManagement';
import AIService from '@contexts/AIService';
import { ChatMessage, MessageInput, EventConfirmationModal } from '@components/chat';
import { chatbot } from '@components/hooks/chatbotHook';
import { useTasks } from '@contexts/TasksContext';
import TaskPlanConfirmationModal from '@components/chat/TaskPlanConfirmationModal';

import { getUsernameFromEmail } from '@components/utils/userManagement';
import DeleteProjectModal from '../components/DeleteProjectModal';
import { sendProjectInvite, cancelProjectInvite } from '../components/utils/projectManagement';
import InviteMemberModal from '../components/InviteMemberModal';

export default function ProjectScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { userInfo } = useUser();
  const currentUserEmail = auth.currentUser?.email || '';
  const scrollViewRef = useRef<ScrollView>(null);
  const { tasks, refreshTasks, addTask } = useTasks();

  // Use the project chat hook for project-specific database operations
  const {
    project,
    messages,
    newMessage,
    setNewMessage,
    loading,
    showMembers,
    sendingMessage,
    handleSendMessage: dbSendMessage,
    isOwnMessage,
    toggleMembers: originalToggleMembers,
    getMemberByEmail,
    isCreator
  } = useProjectChat(projectId as string, currentUserEmail);

  // Add a state for pending invite usernames
  const [pendingInviteUsernames, setPendingInviteUsernames] = useState<Record<string, string>>({});

  // State for showing delete project prompt
  const [deleteProjectPrompt, setDeleteProjectPrompt] = useState(false);

  // State for invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // State for cancelling invite loading
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  // Fetch usernames for pending invites
  useEffect(() => {
    const fetchPendingUsernames = async () => {
      if (!project?.pendingInvites || project.pendingInvites.length === 0) {
        setPendingInviteUsernames({}); // Clear if no pending invites
        return;
      }

      const usernamesMap: Record<string, string> = {};
      const fetchPromises = project.pendingInvites.map(async (email) => {
        try {
          const username = await getUsernameFromEmail(email);
          usernamesMap[email] = username;
        } catch (error) {
          console.warn(`Could not fetch username for pending invite: ${email}`, error);
          usernamesMap[email] = email; // Fallback to email if fetch fails
        }
      });

      await Promise.all(fetchPromises);
      setPendingInviteUsernames(usernamesMap);
    };

    fetchPendingUsernames();
  }, [project?.pendingInvites]); // Rerun when pendingInvites array changes

  // Initialize AI service for project chat
  useEffect(() => {
    const initAI = async () => {
      try {
        const aiService = AIService.getInstance();
        await aiService.initialize();
      } catch (error) {
        console.error("Error initializing AI service for project chat:", error);
      }
    };

    initAI();

    // Cleanup when component unmounts
    return () => {
      const projectChatId = projectId as string;
      if (projectChatId) {
        const aiService = AIService.getInstance();
        aiService.resetChat(`project_${projectChatId}`);
      }
    };
  }, [projectId]);

  // Create a message factory function for the AI hook with username support
  const createProjectMessage = (text: string, sender: string) => {
    // Get username based on sender
    let senderUsername = '';

    // If it's the bot
    if (sender === 'bot') {
      senderUsername = 'Bonsai';
    }
    // If it's the current user
    else if (sender === currentUserEmail) {
      senderUsername = userInfo?.username || '';
    }

    return {
      id: Date.now().toString(),
      text,
      sender,
      senderUsername,
      timestamp: Timestamp.fromDate(new Date())
    };
  };

  const handleMessagesUpdate = (newMessagesOrUpdater: any) => {
    // No implementation needed - we pull from firebase anyway.
    // The real-time listener in useProjectChat will automatically
    // update the messages state when changes occur in the database

    // we need setMessages in chat.tsx and not here
  };

  // Use our new AI chat hook with project chat
  const {
    isProcessing,
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
  } = chatbot({
    chatId: projectId as string,
    messages,
    setMessages: handleMessagesUpdate,
    sendMessage: dbSendMessage,
    tasks,
    refreshTasks,
    addTask, // Pass addTask here
    isProjectChat: true,
    createMessage: createProjectMessage,
    projectId: projectId // Pass the projectId
  });

  // Handle sending project chat message
  const handleProjectSend = async () => {
    if (newMessage.trim()) {
      setNewMessage('');
      const success = await handleSend(newMessage);
    }
  };

  // Handle cancelling a project invite
  const handleCancelInvite = async (inviteEmail: string) => {
    if (!project?.id) return;
    setCancellingInvite(inviteEmail); // Set loading state for this specific invite
    try {
      const result = await cancelProjectInvite(project.id, inviteEmail);
      if (result.success) {
        // Refresh project data implicitly via the listener in useProjectChat
        // No need to manually update pendingInviteUsernames here, it will refetch
        Alert.alert("Success", "Invite cancelled.");
      } else {
        Alert.alert("Error", result.error || "Failed to cancel invite.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "An error occurred while cancelling the invite.");
    } finally {
      setCancellingInvite(null); // Clear loading state
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [loading, messages]);

  // UI functions
  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 250);
    }
  };

  const membersPanelAnimation = useSharedValue(0);

  // Animated styles for the members panel
  const membersPanelStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: interpolate(
            membersPanelAnimation.value,
            [0, 1],
            [300, 0],
            Extrapolation.CLAMP
          )
        }
      ],
      opacity: membersPanelAnimation.value
    };
  });

  // Updated toggle function to animate the panel
  const toggleMembers = () => {
    if (showMembers) {
      // Animate out
      membersPanelAnimation.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic)
      });
      // Delay setting state to false until animation completes
      setTimeout(() => originalToggleMembers(), 300);
    } else {
      // Set state first, then animate in
      originalToggleMembers();
      membersPanelAnimation.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic)
      });
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-950">
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-stone-950"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar style="light" />

      {/* Project title and members icon */}
      <View className="px-4 py-1 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-white text-xl font-bold">{project?.name}</Text>
          <Text className="text-gray-400 text-xs">{project?.members.length} members</Text>
        </View>
        <TouchableOpacity
          onPress={toggleMembers}
          className="ml-2 p-2 bg-stone-800 rounded-full border border-stone-700"
        >
          <Feather name={showMembers ? "x" : "users"} size={20} color="#14b8a6" />
        </TouchableOpacity>
      </View>

      {/* Members panel - now with animation */}
      {showMembers && (
        <Animated.View
          style={membersPanelStyle}
          className="bg-black/90 backdrop-blur-md absolute right-0 top-16 z-50 rounded-l-xl shadow-lg p-4 w-[80%] max-w-[300px] h-[80%] border-l border-teal-900/50"
        >
          <View className="flex-row justify-between items-center">
            <Text className="text-white font-bold text-lg mb-2">Project Members</Text>
          </View>

          <ScrollView className="flex-1">
            <Text className="text-teal-500 text-xs uppercase font-semibold">Members</Text>
            {project?.members.map((member, index) => {
              // Use username directly from the member object
              const seed = encodeURIComponent(member.username);
              const avatarUrl = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${seed}`;
              return (
                <View key={index} className="flex-row items-center py-3 border-b border-gray-800">
                  <Image
                    source={{ uri: avatarUrl }}
                    className="h-9 w-9 rounded-full mr-3"
                  />
                  <View className="flex-1">
                    <Text className="text-white">{member.username}</Text>
                    <Text className="text-gray-500 text-xs">{member.email}</Text>
                  </View>
                  {member.email === project?.creatorEmail && (
                    <View className="ml-2 bg-teal-900/50 px-2 py-1 rounded-full">
                      <Text className="text-teal-400 text-xs">Creator</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {isCreator && project?.pendingInvites && project.pendingInvites.length > 0 && (
              <View className="mt-6">
                <Text className="text-teal-500 text-xs uppercase font-semibold mb-2">Pending Invites</Text>
                {project.pendingInvites.map((inviteEmail, index) => {
                  const username = pendingInviteUsernames[inviteEmail] || inviteEmail; // Fallback to email if username not loaded yet
                  const seed = encodeURIComponent(username);
                  const avatarUrl = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${seed}`;

                  return (
                    <View key={index} className="flex-row items-center py-3 border-b border-gray-800">
                      <Image
                        source={{ uri: avatarUrl }}
                        className="h-9 w-9 rounded-full mr-3"
                      />
                      <View className="flex-1">
                        <Text className="text-white">{username}</Text>
                        <Text className="text-gray-500 text-xs">{inviteEmail}</Text>
                      </View>
                      {/* Cancel Invite Button */}
                      {cancellingInvite === inviteEmail ? (
                        <ActivityIndicator size="small" color="#f87171" className="ml-2" />
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleCancelInvite(inviteEmail)}
                          className="ml-2 p-1.5 bg-red-900/50 rounded-full"
                        >
                          <Feather name="x" size={14} color="#f87171" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {isCreator && (
              <TouchableOpacity
                className="mt-6 bg-teal-800 py-3 px-4 rounded-lg flex-row items-center justify-center"
                onPress={() => setShowInviteModal(true)} // Open the invite modal
              >
                <Feather name="user-plus" size={16} color="white" />
                <Text className="text-white font-medium ml-2">Invite Member</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          {isCreator && (
            <TouchableOpacity
              className="mt-6 bg-black py-2 px-4 rounded-lg flex-row items-center justify-center border-2 border-solid border-red-500"
              onPress={() => setDeleteProjectPrompt(true)}
            >
              <Feather name="trash" size={16} color="#FB2C36" />
              <Text className="text-red-500 font-medium ml-2">Delete Project</Text>
            </TouchableOpacity>
          )}

          <Pressable
            className="absolute -left-10 top-2 p-2 bg-black/80 rounded-l-lg border-l border-t border-b border-teal-900/50"
            onPress={toggleMembers}
          >
            <Feather name="chevron-right" size={20} color="#14b8a6" />
          </Pressable>
        </Animated.View>
      )}

      {/* Main chat area with modern styling */}
      <View className="flex-1 justify-between">
        <View className="flex-1 relative">
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 pt-4 pb-4 w-full px-4"
            contentContainerStyle={{
              justifyContent: 'flex-end',
              flexGrow: messages.length === 0 ? 1 : undefined
            }}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View className="flex-1 justify-center items-center p-4">
                <View className="bg-stone-800/50 p-4 rounded-2xl items-center">
                  <Feather name="message-circle" size={40} color="#14b8a6" />
                  <Text className="text-gray-400 mt-2 text-center">
                    No messages yet in this project.{"\n"}Start the conversation!
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View className="w-full items-center mb-6 mt-2">
                  <View className="bg-stone-800/70 px-4 py-1 rounded-full">
                    <Text className="text-gray-400 text-xs">
                      Project created {project?.createdAt?.toDate().toLocaleDateString() || "recently"}
                    </Text>
                  </View>
                </View>

                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={{
                      id: message.id,
                      text: message.text,
                      sender: message.sender,
                      senderUsername: message.senderUsername,
                      timestamp: message.timestamp
                    }}
                    isProjectChat={true}
                  />
                ))}
              </>
            )}

            {(sendingMessage || isProcessing) && (
              <View className="bg-stone-800 rounded-lg px-4 py-3 my-1">
                <ActivityIndicator size="small" color="#14b8a6" />
              </View>
            )}
          </ScrollView>

          {/* Gradient fade at top */}
          <LinearGradient
            colors={['#09090b', 'transparent']}
            className="absolute top-0 left-0 right-0 h-20 z-10 pointer-events-none"
          />
        </View>

        {/* MESSAGE INPUT */}
        <View>
          <MessageInput
            value={newMessage}
            onChangeText={setNewMessage}
            onSend={handleProjectSend}
            onFocus={() => {
              scrollToBottom();
            }}
            disabled={!newMessage.trim() || sendingMessage || isProcessing}
            isLoading={sendingMessage || isProcessing}
          />
        </View>

        <DeleteProjectModal
          email={userInfo?.email}
          projectId={project?.id}
          visible={deleteProjectPrompt}
          onRequestClose={() => {
            setDeleteProjectPrompt(false);
          }}
        />
      </View>

      {/* Invite Member Modal */}
      {project && (
        <InviteMemberModal
          visible={showInviteModal}
          onRequestClose={() => setShowInviteModal(false)}
          projectId={project.id}
          projectName={project.name}
          currentMembers={project.members.map(m => m.email)} // Pass emails of current members
          pendingInvites={project.pendingInvites} // Pass emails of pending invites
        />
      )}

      {/* Modals for AI processing results */}
      {pendingEvents.length > 0 && currentEventIndex < pendingEvents.length && (
        <EventConfirmationModal
          visible={showEventConfirmation}
          eventDetails={pendingEvents[currentEventIndex]}
          onConfirm={handleConfirmEvent}
          onCancel={handleCancelEvent}
          eventCount={pendingEvents.length}
          currentEventIndex={currentEventIndex}
          isTaskPlanEvent={pendingEvents[currentEventIndex]?.isTaskPlanEvent || false}
          isProjectChat={true} // Pass true for project chat
          currentUserIdentifier={userInfo?.username || userInfo?.email || null} // Pass current user identifier
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
