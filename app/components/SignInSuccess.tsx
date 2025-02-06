import { View, Text } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useEffect, useRef } from 'react';

export default function SignInSuccess() {
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    setTimeout(() => {
      if (confettiRef.current) {
        confettiRef.current.start();
      }
    }, 100);
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-white">
      <Text className="text-2xl font-bold mb-4">Successfully Signed In! 🎉</Text>
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