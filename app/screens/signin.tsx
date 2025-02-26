import { View, Text, Image, TouchableOpacity, Modal } from 'react-native';
import { useState } from 'react';
import { Link } from 'expo-router';
import GoogleSignIn from '@components/GoogleSignIn';
import GradientButton from '@components/GradientButton';
import GradientText from '@components/GradientText';
import ForgotPasswordModal from '@components/ForgotPasswordModal';
import TextInput from '@components/TextInput';

export default function SignIn() {
  const [forgotPasswordPrompt, setForgotPasswordPrompt] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View className="flex-1 bg-stone-950 p-6 pt-16 justify-between">
      <View className="w-full max-w-sm items-center">
        <Image
          source={require('@assets/images/bonsai-logo.png')}
          className="w-24 h-24 mb-2"
          resizeMode="contain"
        />
        <GradientText
          text="Sign in"
          classStyle="text-4xl font-black"
          size={[800, 80]}
        />
        <GoogleSignIn />

        <View className="w-full flex-row items-center my-4">
          <View className="flex-1 h-[1px] bg-gray-700" />
          <Text className="text-gray-400 mx-4">or</Text>
          <View className="flex-1 h-[1px] bg-gray-700" />
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email/Username"
          classStyle='mb-4 text-base'
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          classStyle='mb-4 text-base'
          secureTextEntry
        />

        <GradientButton
          text="Sign In"
          onPress={() => { }}
          containerClassName="mt-4"
          textClassName="text-white text-lg"
        />

        <TouchableOpacity
          className="mt-8"
          onPress={() => setForgotPasswordPrompt(true)}
        >
          <Text className="text-teal-500">Forgot password?</Text>
        </TouchableOpacity>

        <ForgotPasswordModal
          visible={forgotPasswordPrompt}
          onRequestClose={() => setForgotPasswordPrompt(false)}
        />
      </View>

      <View className="w-full flex-row justify-center items-center gap-2 mb-8">
        <Text className="text-slate-400">Don't have an account?</Text>
        <Link href="/screens/signup" className="text-teal-500 font-semibold">
          Sign Up!
        </Link>
      </View>
    </View>
  );
}
