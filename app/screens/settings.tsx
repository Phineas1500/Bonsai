import { View, Text, Button, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useUser } from '@contexts/UserContext';
import React from 'react';
import { router } from 'expo-router';
import { auth } from '@/firebaseConfig';
import { signOut } from 'firebase/auth';

import ChangeUsernameModal from '@components/ChangeUsernameModal';
import DeleteAccountModal from '@components/DeleteAccountModal';

export default function Settings() {
    const { userInfo, setUserInfo } = useUser();
    const [changeUsernamePrompt, setChangeUsernamePrompt] = useState(false);
    const [deleteAccountPrompt, setDeleteAccountPrompt] = useState(false);

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
                ...(userInfo ?? { username: "", email: "", usesGoogle: false }),
                calendarAuth: {
                    access_token: authObj.accessToken || "",
                    refresh_token: authObj.refreshToken || ""
                }
            };
            setUserInfo(newUserInfo);
        }
    }, [response]);

    // Handle user logout
    const handleLogout = async () => {
        try {
            Alert.alert(
                "Logout",
                "Are you sure you want to logout?",
                [
                    {
                        text: "Cancel",
                        style: "cancel"
                    },
                    {
                        text: "Logout",
                        onPress: async () => {
                            // Clear user context data
                            setUserInfo(null);

                            // Sign out from Firebase
                            await signOut(auth);

                            console.log("User logged out successfully");

                            // Redirect to sign-in page
                            router.replace('/screens/welcome');
                        },
                        style: "destructive"
                    }
                ]
            );
        } catch (error: any) {
            console.error("Logout error:", error);
            Alert.alert("Error", "Failed to logout. Please try again.");
        }
    };

    return (
        <>
            <View className="flex-1 flex-col items-start bg-stone-950 p-6">
                <View className="w-full mb-6">
                    <Text className="text-white text-lg mb-2">Account</Text>
                    <TouchableOpacity
                        onPress={() => setChangeUsernamePrompt(true)}
                        className="py-3 border-b border-gray-800"
                    >
                        <Text className="text-teal-500">Change Username</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setDeleteAccountPrompt(true)}
                        className="py-3 border-b border-gray-800"
                    >
                        <Text className="text-teal-500">Delete Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleLogout}
                        className="py-3 border-b border-gray-800"
                    >
                        <Text className="text-teal-500">Logout</Text>
                    </TouchableOpacity>
                </View>

                <View className="w-full mb-6">
                    <Text className="text-white text-lg mb-2">Integrations</Text>
                    <Button
                        disabled={!request}
                        title="Connect Google Calendar"
                        onPress={() => promptAsync()}
                    />
                </View>

                <ChangeUsernameModal
                    visible={changeUsernamePrompt}
                    currentUsername={userInfo?.username || ""}
                    onRequestClose={() => {
                        setChangeUsernamePrompt(false);
                    }}
                />
                <DeleteAccountModal
                    visible={deleteAccountPrompt}
                    onRequestClose={() => {
                        setDeleteAccountPrompt(false);
                    }}
                />
            </View>
        </>
    );
}