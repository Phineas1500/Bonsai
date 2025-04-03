import { View, Text, Button } from 'react-native';
import { useEffect, useState } from 'react';
import GradientButton from '@components/GradientButton';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useUser } from '@contexts/UserContext';
import React from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { NotificationPayload, sendPushNotification } from '../components/utils/notificationAPI';

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

    const {enableNotifications, expoPushToken, notifications, error} = useNotification();

    useEffect(() => {
        if (response?.type === 'success') {
            const authObj = response.authentication;
            if (!authObj) {
                console.error("Auth object is null!");
                return;
            }
            console.log("Auth Successful:", authObj);

            const newUserInfo = {
                ...(userInfo ?? { username: "", email: "", usesGoogle: false }),
                calendarAuth: {
                    access_token: authObj.accessToken || "",
                    refresh_token: authObj.refreshToken || ""
                }
            };
            setUserInfo(newUserInfo);
        }
    }, [response]);

    const showNotification = async () => {

        const myEmail = userInfo?.email;
        if (!myEmail) return;

        const hello: NotificationPayload = {
            email: userInfo.email,
            title: "Hello!",
            body: "This is a hello message",
            data: {}
        }
        sendPushNotification(hello);
    }

    return (
        <>
            <View className="flex-1 flex-col items-start bg-stone-950 p-6">
                <Text className="text-lg font-light text-teal-500 text-center">
                    Settings
                </Text>
                <Button
                    disabled={!request}
                    title="Connect Google Calendar"
                    onPress={() => promptAsync()}
                />
                <Button
                    title="Enable Notifications"
                    onPress={() => enableNotifications()}
                />
                <Button
                    title="Show notification"
                    onPress={() => showNotification()}
                />
                <Text className='text-white'>
                    push token: {expoPushToken} 
                </Text>
                <Text className='text-white'>
                    notifications: {JSON.stringify(notifications)}
                </Text>
            </View>
        </>

    );
}