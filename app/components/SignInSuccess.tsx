import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useEffect, useRef } from 'react';
import GradientButton from '@components/GradientButton';

export default function SignInSuccess() {
  console.log("component mounted");
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
    <View className="flex-1 bg-stone-950">
      <View className="absolute top-12 right-6 z-10">
        <Button
          title="Start Chatting"
          onPress={() => router.push('/screens/chat')}
        />
      </View>

      <View className="flex-1 justify-center items-center">
        <Text className="text-2xl font-bold mb-4 text-white">Successfully Signed In! 🎉</Text>
      </View>

      <ConfettiCannon
        ref={confettiRef}
        count={200}
        origin={{x: -10, y: 0}}
        autoStart={false}
        fadeOut={true}
        explosionSpeed={350}
        fallSpeed={3000}
        colors={['#ff0', '#0ff', '#f0f', '#ff0']}
      />
    </View>
  );
}