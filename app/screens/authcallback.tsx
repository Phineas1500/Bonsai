import { View, Text, Image } from 'react-native';
import { router } from 'expo-router';
import GradientButton from '@components/GradientButton';
import GradientText from '@components/GradientText';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

export default function Welcome() {

  const router = useRouter();
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    setTimeout(() => {
      if (confettiRef.current) {
        confettiRef.current.start();
      }
    }, 100);
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-stone-950 p-6">
      <View className="w-full max-w-sm items-center">
        <Text className="text-sm font-light text-teal-500 text-center">
          Successfully Signed In! 🎉
        </Text>

        <GradientButton
          text='Start Chatting'
          onPress={() => router.push('/screens/chat')}
          containerClassName="mt-8"
          textClassName='text-white text-lg'
        />
        <ConfettiCannon
          ref={confettiRef}
          count={200}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          fadeOut={true}
          explosionSpeed={350}
          fallSpeed={3000}
          colors={['#ff0', '#0ff', '#f0f', '#ff0']}
        />
      </View>
    </View>
  );
}
