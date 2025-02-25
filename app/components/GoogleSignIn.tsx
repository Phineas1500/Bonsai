import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

import { useEffect, useState } from 'react';
import SignInSuccess from './SignInSuccess';
import GradientButton from './GradientButton';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignIn() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      console.log(authentication);
      setIsSignedIn(true);
    }
  }, [response]);

  if (isSignedIn) {
    return <SignInSuccess />;
  }

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