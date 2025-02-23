import { View, Text, Image, TouchableOpacity, Modal } from 'react-native';
import { useState } from 'react';
import { Link } from 'expo-router';
import GoogleSignIn from '@components/GoogleSignIn';
import GradientButton from '@components/GradientButton';
import ForgotPasswordModal from '@components/ForgotPasswordModal';

export default function SignIn() {
  const [forgotPasswordPrompt, setForgotPasswordPrompt] = useState(false);

  return (
    <View className="flex-1 justify-center items-center bg-stone-950 p-6">
      <View className="w-full max-w-sm items-center">
        <Image
          source={require('@assets/images/bonsai-logo.png')}
          className="w-24 h-24 mb-8"
          resizeMode="contain"
        />
        <Text className="text-3xl font-bold text-white text-center mb-12">
          Welcome Back
        </Text>
        <GoogleSignIn />
        <GradientButton
          text='Sign in'
          onPress={() => {}}
          containerClassName="mt-2"
        />
        <TouchableOpacity 
          className="mt-8"
          onPress={() => setForgotPasswordPrompt(true)}
        >
          <Text className="text-slate-400">Forgot password?</Text>
        </TouchableOpacity>
        <View className="mt-8 flex-row justify-center items-center gap-2">
          <Text className="text-slate-400">Don't have an account?</Text>
          <Link href="/screens/signup" className="text-blue-400 font-semibold">
            Sign Up
          </Link>
        </View>
        <ForgotPasswordModal 
          visible={forgotPasswordPrompt}
          onRequestClose={() => setForgotPasswordPrompt(false)}
        />
      </View>
    </View>
  );
}
