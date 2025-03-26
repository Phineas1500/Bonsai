import { View } from 'react-native';
import React from 'react';
import GradientText from '@components/GradientText';
import UserLabel from '@components/UserLabel';

export default function Social() {

  return (
    <>
      <View className="flex-1 flex-col items-start bg-stone-950 px-6 pt-6">
        <View className="w-full items-center justify-center">
          <GradientText classStyle="text-center text-4xl font-black" text="Social" size={[200, 50]} />
          <View className="w-full px-2">
            <UserLabel
              username="Friend 1"
            />
          </View>
        </View>
      </View>
    </>
  );
}