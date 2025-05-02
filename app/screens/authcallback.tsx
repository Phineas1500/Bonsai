import { View, Text, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import GradientButton from '@components/GradientButton';
import GradientText from '@components/GradientText';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { auth } from '@/firebaseConfig';
import { getUserByEmail } from '@components/utils/userManagement';
import { useUser } from '@contexts/UserContext';

export default function Welcome() {

  const router = useRouter();
  const confettiRef = useRef<any>(null);
  const { updateUserInfo } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize the loadUserData function to prevent it from being recreated on every render
  const loadUserData = useCallback(async () => {
    try {
      const user = auth.currentUser;

      if (!user || !user.email) {
        throw new Error('No authenticated user found');
      }

      // Fetch user data from Firestore
      const userDoc = await getUserByEmail(user.email);

      if (!userDoc) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();

      // Create a smaller update object with only essential data
      // This helps reduce the size of state updates
      updateUserInfo({
        username: userData.username,
        email: userData.email,
        usesGoogle: userData.signinType === 'google',
        signinType: userData.signinType,
        createdAt: userData.createdAt,

        additionalSettings: userData.additionalSettings || {},

        // Use null coalescing for arrays to avoid unnecessary array creations
        friends: userData.friends ?? [],
        incomingFriendRequests: userData.incomingFriendRequests ?? [],
        outgoingFriendRequests: userData.outgoingFriendRequests ?? [],
        streak: userData.streak ?? 0,
        lastCheckInDate: userData.lastCheckInDate ?? "0",
        achievements: userData.achievements ?? [],
      });

      // Start confetti animation after a small delay
      setTimeout(() => {
        if (confettiRef.current) {
          confettiRef.current.start();
        }
      }, 100);

    } catch (err: any) {
      console.error('Error loading user data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [updateUserInfo]); // Include updateUserInfo in dependencies

  // Only run loadUserData once when the component mounts
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-950">
        <ActivityIndicator size="large" color="#14b8a6" />
        <Text className="text-white mt-4">Loading your profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-950 p-6">
        <Text className="text-red-500 mb-4">Error: {error}</Text>
        <GradientButton
          text='Try Again'
          onPress={() => router.push('/screens/signin')}
          containerClassName="mt-4"
          textClassName='text-white text-lg'
        />
      </View>
    );
  }

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
