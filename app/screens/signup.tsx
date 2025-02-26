import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { Link, router } from 'expo-router';

import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from 'firebaseConfig';
import { createUserDocument, validateSignInMethod, getUserByUsername } from '@components/utils/userManagement';

import GoogleSignIn from '@components/GoogleSignIn';
import GradientButton from '@components/GradientButton';
import GradientText from '@components/GradientText';
import TextInput from '@components/TextInput';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (pass: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasLowerCase = /[a-z]/.test(pass);
    const hasNumbers = /\d/.test(pass);
    // const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);

    if (pass.length < minLength) return 'Password must be at least 8 characters long';
    if (!hasUpperCase) return 'Password must contain at least one uppercase letter';
    if (!hasLowerCase) return 'Password must contain at least one lowercase letter';
    if (!hasNumbers) return 'Password must contain at least one number';
    // if (!hasSpecialChar) return 'Password must contain at least one special character';
    return '';
  };

  const handleSignUp = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Basic validation
      if (!username || !email || !password || !confirmPassword) {
        throw new Error('Please fill in all fields');
      }

      // Check if email is already in use
      const existingEmail = await validateSignInMethod(email, 'email');
      if (existingEmail.error) {
        throw new Error(existingEmail.error);
      }

      if (existingEmail.exists) {
        throw new Error('Email is already in use');
      }

      // Check username uniqueness
      const existingUser = await getUserByUsername(username);
      if (existingUser) {
        throw new Error('Username is already taken');
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        throw new Error(passwordError);
      }

      // Create user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Set display name
      await updateProfile(userCredential.user, {
        displayName: username
      });

      // Create user document in Firestore
      await createUserDocument(email, username, "email");

      router.push('/screens/authcallback');
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

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
          text={isLoading ? "Creating Account..." : "Create Account"}
          onPress={handleSignUp}
          containerClassName="mt-4"
          textClassName="text-white text-lg"
          disabled={isLoading}
        />
        {error ? <Text className="text-red-500 mt-2 text-center">{error}</Text> : null}
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
