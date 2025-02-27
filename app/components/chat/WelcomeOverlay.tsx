import React from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientText from '@components/GradientText';
import { auth } from '@/firebaseConfig';
import TasksSnapshot from './TasksSnapshot';

interface WelcomeOverlayProps {
  opacity: Animated.Value;
}

const WelcomeOverlay = ({ opacity }: WelcomeOverlayProps) => {
  // Get current time for greeting
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
      <View className="items-center space-y-6 w-full -translate-y-20">
        <GradientText
          text={`${greeting},\n${auth.currentUser?.displayName}!`}
          classStyle="text-center text-4xl font-black"
          size={[400, 80]}
        />

        <TasksSnapshot />

        {/* <Text className="text-gray-400 text-center">
          Tap the input box below to start chatting
        </Text>
        <View className="animate-bounce">
          <Ionicons name="chevron-down" size={24} color="#14b8a6" />
        </View> */}
      </View>
    </Animated.View>
  );
};

export default WelcomeOverlay;
