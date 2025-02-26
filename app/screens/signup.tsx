import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Link } from 'expo-router';
import GoogleSignIn from '@components/GoogleSignIn';
import GradientButton from '@components/GradientButton';
import GradientText from '@components/GradientText';
import TextInput from '@components/TextInput';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <View className="flex-1 bg-stone-950 p-6 pt-16 justify-between">
      <View className="w-full max-w-sm items-center">
        <Image
          source={require('@assets/images/bonsai-logo.png')}
          className="w-24 h-24 mb-2"
          resizeMode="contain"
        />
        <GradientText
          text="Register"
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
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          classStyle='mb-4 text-base'
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          classStyle='mb-4 text-base'
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          classStyle='mb-4 text-base'
          secureTextEntry
        />
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter Password"
          classStyle='mb-4 text-base'
          secureTextEntry
        />

        <GradientButton
          text="Create Account"
          onPress={() => {}}
          containerClassName="mt-4"
          textClassName="text-white text-lg"
        />
      </View>

      <View className="w-full flex-row justify-center items-center gap-2 mb-8">
        <Text className="text-slate-400">Already have an account?</Text>
        <Link href="/screens/signin" className="text-teal-500 font-semibold">
          Sign In!
        </Link>
      </View>
    </View>
  );
}
