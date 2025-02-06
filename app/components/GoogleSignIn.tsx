import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Button } from 'react-native';
import { useEffect, useState } from 'react';
import SignInSuccess from './SignInSuccess';
import { CLIENT_ID, IOS_CLIENT_ID, ANDROID_CLIENT_ID } from '@env';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignIn() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: CLIENT_ID,
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