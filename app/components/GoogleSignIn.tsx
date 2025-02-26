import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import GradientButton from './GradientButton';
import { auth } from 'firebaseConfig';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { updateProfile } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignIn() {
  const router = useRouter();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      console.log('Full auth response:', response.authentication);

      if (response.authentication?.accessToken) {
        const credential = GoogleAuthProvider.credential(
          null,
          response.authentication.accessToken
        );

        signInWithCredential(auth, credential)
          .then(async (result) => {
            console.log('Firebase sign-in successful:', result.user);
            // If user has no display name, set a default one
            if (!result.user.displayName) {
              const defaultUsername = `user${Math.floor(Math.random() * 10000)}`;
              await updateProfile(result.user, {
                displayName: defaultUsername
              });
            }
            router.push('/screens/authcallback');
          })
          .catch((error) => {
            console.error('Firebase sign-in error:', error);
          });
      } else {
        console.error('No access token found in response');
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