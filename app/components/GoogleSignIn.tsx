import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Alert } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import GradientButton from './GradientButton';
import * as AuthSession from 'expo-auth-session';
import { auth } from 'firebaseConfig';
import { GoogleAuthProvider, signInWithCredential, updateProfile } from 'firebase/auth';

import { useUser } from '@contexts/UserContext';
import { createUserDocument, getUserByUsername, validateSignInMethod } from '@components/utils/userManagement';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignIn() {
  const router = useRouter();
  const { userInfo, updateUserInfo } = useUser(); // Use the new updateUserInfo function

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_CLIENT_ID,
    scopes: ['profile', 'email', 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/tasks', 'https://www.googleapis.com/auth/calendar.events'], // Add Calendar scope
    redirectUri: AuthSession.makeRedirectUri()
  });

  const generateUniqueUsername = async (baseName: string) => {
    let username = baseName.replace(/\s+/g, '').toLowerCase();
    let usernameTaken = await getUserByUsername(username);
    let counter = 1;

    while (usernameTaken) {
      username = `${baseName}${counter}`;
      usernameTaken = await getUserByUsername(username);
      counter++;
    }

    return username;
  };

  useEffect(() => {
    if (response?.type === 'success') {
      console.log('Full auth response:', response.authentication);

      if (response.authentication?.accessToken) {
        // Calculate expiration time (default to 1 hour if expiresIn not provided)
        const expiresIn = response.authentication.expiresIn || 3600;
        const expiresAt = Date.now() + expiresIn * 1000;

        // Save the calendar authentication info
        updateUserInfo({
          usesGoogle: true,
          googleAuth: {
            access_token: response.authentication.accessToken
          },
          calendarAuth: {
            access_token: response.authentication.accessToken,
            expires_at: expiresAt
          }
        });

        const credential = GoogleAuthProvider.credential(
          response.authentication.idToken || null,
          response.authentication.accessToken
        );

        signInWithCredential(auth, credential)
          .then(async (result) => {
            if (!result.user.email) {
              throw new Error('No email provided by Google');
            }

            // Validate signin method
            const validation = await validateSignInMethod(result.user.email, 'google');
            if (validation.error) {
              throw new Error(validation.error);
            }

            // If user doesn't exist, create new account
            if (!validation.exists) {
              const baseUsername = result.user.displayName || 'user';
              const uniqueUsername = await generateUniqueUsername(baseUsername);

              // Update user info with Firebase user data
              updateUserInfo({
                username: uniqueUsername,
                email: result.user.email,
                id_token: response.authentication?.idToken || undefined
              });

              // Update display name
              await updateProfile(result.user, {
                displayName: uniqueUsername
              });

              // Create or update user document in Firestore
              if (result.user.email) {
                await createUserDocument(result.user.email, uniqueUsername, "google");
              }
            }

            //add the username and email to user info context
            updateUserInfo({
              username: result.user.displayName || 'user',
              email: result.user.email,
              id_token: response.authentication?.idToken || undefined
            });

            router.push('/screens/authcallback');
          })
          .catch((error) => {
            // console.error('Firebase sign-in error:', error);
            Alert.alert('Error', error.message);
          });
      } else {
        // console.error('No access token found in response');
        Alert.alert('Error', 'Failed to sign in with Google. No access token found in response.');
      }
    }
  }, [response]);

  return (
    <GradientButton
      text='Continue with Google'
      containerClassName=""
      outline
      textClassName="text-lg"
      onPress={() => promptAsync()}
    />
  );
}