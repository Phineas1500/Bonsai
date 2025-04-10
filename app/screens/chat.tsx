import { View, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Animated } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

import { useUser } from '@contexts/UserContext';
import { createChat, getMessages, getUserChats, sendMessage } from '@components/utils/chatManagement';
import { ChatMessage, MessageInput, WelcomeOverlay, Message, EventConfirmationModal } from '@components/chat';
import TaskPlanConfirmationModal from '@components/chat/TaskPlanConfirmationModal';
import { useTasks } from '@contexts/TasksContext';
import { updateUserStreak } from '@components/utils/userManagement';
import { chatbot } from '@/app/components/hooks/chatbotHook';
import { Timestamp } from 'firebase/firestore';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { userInfo } = useUser();
  const scrollViewRef = useRef<ScrollView>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  const [dailyStreakCheckIn, setDailyStreakCheckIn] = useState(false);
  const { tasks, refreshTasks } = useTasks();

  // Create a message factory function for the AI hook
  const createMessage = (text: string, sender: string): Message => {
    return {
      id: Date.now().toString(),
      text,
      sender,
      senderUsername: sender === 'bot' ? 'Bonsai' : userInfo?.username ?? 'bot',
      timestamp: Timestamp.fromDate(new Date())
    };
  };

  // Use our new AI chat hook
  const {
    isProcessing,
    uploadedContent,
    setUploadedContent,
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
  } = chatbot<Message>({
    chatId,
    messages,
    setMessages,
    sendMessage,
    tasks,
    refreshTasks,
    isProjectChat: false,
    createMessage
  });

  // Initialize chat
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

  // UI functions
  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 250);
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

  // Initialize chat with Firebase
  const initializeChat = async () => {
    setIsLoading(true);
    const userEmail = userInfo?.email;
    if (!userEmail) {
      console.log("User info:", userInfo);
      setIsLoading(false);
      return;
    }

    const userChats = await getUserChats(userEmail);

    if (userChats.length <= 0) {
      // If the user doesn't have a chat, then create one
      const c = await createChat(userEmail);
      setChatId(c);
      console.log("No chats found for user. Created chat with id: ", c);

      if (!c) {
        setIsLoading(false);
        return;
      }

      let firstMessage: Message = {
        id: '1',
        text: "Hi there! I'm your personal assistant. You can ask me to add events to your calendar by saying something like 'Add a meeting with John tomorrow at 2pm'.",
        sender: 'bot',
        senderUsername: 'Bonsai',
        timestamp: Timestamp.fromDate(new Date())
      };

      await sendMessage(c, firstMessage);
      setMessages([firstMessage]);
    } else {
      // If the user has a chat, then load messages from it
      const chatId = userChats[0].id;
      if (!chatId) {
        console.error("ChatId is null");
        setIsLoading(false);
        return;
      }

      setChatId(userChats[0].id); // For now, assume only one chat
      const chatMessages = await getMessages(chatId);
      setMessages(chatMessages);
    }

    setIsLoading(false);
  };

  const handleDailyChatbotCheckIn = async () => {
    // Chatbot check in complete, update streak if applicable
    if (!dailyStreakCheckIn) {
      if (userInfo) {
        const checkedIn = await updateUserStreak(userInfo.email);
        setDailyStreakCheckIn(checkedIn);
      } else {
        console.log("Couldn't get userInfo, streak not updated");
      }
    }
  };

  // Combine our custom handle send with streak check
  const handleSendWithStreak = async () => {
    const success = await handleSend(message);
    if (success) {
      setMessage('');
      handleDailyChatbotCheckIn();
    }
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
            {(isLoading || isProcessing) && (
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
          onSend={handleSendWithStreak}
          onPdfSelected={(text, filename) => setUploadedContent({text, filename})}
          disabled={isLoading || isProcessing || !message.trim()}
          onFocus={() => {
            fadeOutWelcome();
            scrollToBottom();
          }}
          uploadedContent={uploadedContent}
          clearUploadedContent={() => setUploadedContent(null)}
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