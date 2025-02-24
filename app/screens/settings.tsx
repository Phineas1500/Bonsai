import { View, Text, Button} from 'react-native';
import { useEffect, useState } from 'react';
import GradientButton from '@components/GradientButton';
import Navbar from '../components/Navbar';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useUser } from '../contexts/UserContext';
import axios from "axios";

export default function Settings() {

    const { userInfo, setUserInfo } = useUser();

    const redirectUri = AuthSession.makeRedirectUri({
        path: '/screens/settings'
    });

    const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: process.env.EXPO_PUBLIC_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
        androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
        webClientId: process.env.EXPO_PUBLIC_CLIENT_ID,
        redirectUri,
        scopes: [
            'openid',
            'profile',
            'email',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ]
    });

    useEffect(() => {
        if (response?.type === 'success') {
            const authObj = response.authentication;
            if (!authObj) {
                console.error("Auth object is null!");
                return;
            }
            console.log("Auth Successful:", authObj);

            const newUserInfo = {
                ...(userInfo ?? { username: "", email: "", usesGoogle: false}),
                calendarAuth: {
                    access_token: authObj.accessToken || "",
                    refresh_token: authObj.refreshToken || ""
                }
            };
            setUserInfo(newUserInfo);
            console.log("New User info:", newUserInfo);

            fetchCalendarEvents();
        }
    }, [response]);

    //fetch tasks from google calendar
    const fetchCalendarEvents = async () => {
    
        if (!userInfo?.calendarAuth?.access_token) {
            console.error("No access token available");
            return;
        }
    
        try {
            const response = await axios.get("https://www.googleapis.com/oauth2/v1/userinfo", {
                headers: {
                    Authorization: `Bearer ${userInfo.calendarAuth.access_token}`
                }
            });
    
            console.log("Calendar Events:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching calendar events:", error);
        }
    };
    

  return (
    <>
        <Navbar />
        <View className="flex-1 flex-col items-start bg-stone-950 p-6">
            <Text className="text-lg font-light text-teal-500 text-center">
                Settings
            </Text>
            <Button
                  disabled={!request}
                  title="Connect Google Calendar"
                  onPress={() => promptAsync()}
            />
        </View>
    </>
    
  );
}