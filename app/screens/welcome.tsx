import { View, Text, Image } from 'react-native';
import { router } from 'expo-router';
import GradientButton from '@components/GradientButton';
import GradientText from '@components/GradientText';

export default function Welcome() {
  return (
    <View className="flex-1 justify-center items-center bg-stone-950 p-6">
      <View className="w-full max-w-sm items-center">
        <Text className="text-sm font-light text-teal-500 text-center">
          Welcome to
        </Text>
        {/* <GradientText
          text="Bonsai"
          className="text-6xl font-black text-center"
        /> */}
        <Image
          source={require('@assets/images/bonsai-logo.png')}
          className="w-24 h-24 mb-8"
          resizeMode="contain"
        />
        <GradientButton
          text='Sign in'
          onPress={() => router.push('/screens/signin')}
          containerClassName="mt-2"
        />
        <GradientButton
          text='Register'
          onPress={() => router.push('/screens/signup')}
          containerClassName="mt-2"
        />
      </View>
    </View>
  );
}
