import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Button } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import GradientButton from './GradientButton';

WebBrowser.maybeCompleteAuthSession();
//const { setUserInfo } = useUser();

export default function GoogleSignIn() {

  const redirectUri = AuthSession.makeRedirectUri({
    path: '/screens/authcallback'
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_CLIENT_ID,
    redirectUri
  });

  console.log("Redirect url:", redirectUri);

  /*
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      console.log(authentication);

    }
  }, [response]);
  */

  /*
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      console.log(authentication);
      setIsSignedIn(true);
    }
  }, [response]);

  if (isSignedIn) {
    console.log("sign in success!");
    return <SignInSuccess />;
  }
  */

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