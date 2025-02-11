import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Button } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { useEffect, useState } from 'react';
import SignInSuccess from './SignInSuccess';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignIn() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "com.phineas1500.bonsai",
  })

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_CLIENT_ID,
    redirectUri
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
    <Button
      disabled={!request}
      title="Sign in with Google"
      onPress={() => promptAsync()}
    />
  );
}