import { View, Text} from 'react-native';
import { useState } from 'react';
import GradientButton from '@components/GradientButton';
import Navbar from '../components/Navbar';

export default function Tasks() {

  return (

    //fetch tasks from google calendar
    <>
      <Navbar />
      <View className="flex-1 flex-col items-start bg-stone-950 p-6">
          <Text className="text-sm font-light text-teal-500 text-center">
              Tasks:
          </Text>
      </View>
    </>
  );
}