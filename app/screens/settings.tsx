import { View, Text, Button, TouchableOpacity, Alert, Switch } from 'react-native';
import { useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useUser } from '@contexts/UserContext';
import React from 'react';
import { NotificationPreferences, useNotification } from '../contexts/NotificationContext';
import { NotificationPayload, sendPushNotification } from '../components/utils/notificationAPI';
import { router } from 'expo-router';
import { auth } from '@/firebaseConfig';
import { signOut } from 'firebase/auth';

import ChangeUsernameModal from '@components/ChangeUsernameModal';
import DeleteAccountModal from '@components/DeleteAccountModal';
import { ScrollView } from 'react-native-gesture-handler';

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
            'https://www.googleapis.com/auth/calendar.events',
        ]
    });

    const {enableNotifications, expoPushToken, notifications, error, updateNotificationPreferences, notificationPreferences} = useNotification();

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

    //handle toggling notifications
    const switchEnabled = notificationPreferences.notificationsEnabled;

    const toggleNotifications = async () => {
        if (!userInfo?.email) {
            console.error("User email isn't available");
            return;
        }

        const newVal : boolean = !switchEnabled;

        //if enabling notifications, request that
        if (newVal) {
            await enableNotifications();
        }
        
        const newPrefs : Partial<NotificationPreferences> = {
            notificationsEnabled: newVal
        }
        await updateNotificationPreferences({ ...newPrefs }, userInfo?.email);
    }

    //handle selecting the type of notifications
    const currentTriggers = notificationPreferences.triggers;

    const triggerOptions = [
        { label: "Tasks", value: "tasks"},
        { label: "Friend Requests", value: "friend-requests" }
    ]

    const toggleTrigger = (trigger: string) => {
        if (!userInfo?.email) {
            console.error("Unable to get user info");
            return;
        }

        const updatedTriggers = currentTriggers.includes(trigger)
          ? currentTriggers.filter(t => t !== trigger)
          : [...currentTriggers, trigger];
        
        updateNotificationPreferences({ triggers: updatedTriggers }, userInfo.email);
    };

    //handle selecting notification frequency 
    const currentOffsets = notificationPreferences.reminderOffsets;
    const frequencyOptions = [
        { label: "When it starts", value: 0 },
        { label: "5 minutes before", value: 5 },
        { label: "10 minutes before", value: 10 }
    ]

    const toggleFrequency = (minuteOffset: number) => {
        if (!userInfo?.email) {
            console.error("User email isn't available when trying to query notification frequency");
            return;
        }

        const updatedOffsets = currentOffsets.includes(minuteOffset)
          ? currentOffsets.filter(o => o !== minuteOffset)
          : [...currentOffsets, minuteOffset];

        updateNotificationPreferences({ reminderOffsets: updatedOffsets }, userInfo.email);
    }

    return (
        <>
        <ScrollView className='flex-1'>
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

                <View className="w-full mb-6">
                    <Text className="text-white text-lg border-b border-gray-800 py-3 ">Notifications</Text>
                    {/* Notifications toggle */}
                    <View className="flex-row items-center justify-between mb-4 border-b border-gray-800 py-3">
                        <Text className="text-white text-sm font-thin ">Notifications enabled:</Text>
                        <Switch
                            trackColor={{ false: "#ccc", true: "#81b0ff" }}
                            thumbColor={switchEnabled ? "#007aff" : "#f4f3f4"}
                            ios_backgroundColor="#ccc"
                            onValueChange={toggleNotifications}
                            value={switchEnabled}
                        />
                        
                    </View>
                    {/* Notification preferences */}
                    <View className="border-b mb-4 border-gray-800">
                        <Text className="text-white font-bold text-sm mb-1">What do you want to be notified about?</Text>
                        {triggerOptions.map(trigger => (
                            <View key={trigger.value} className="flex-row items-center justify-between py-2">
                            <Text className="text-white font-thin capitalize">{trigger.label}</Text>
                            <Switch
                                value={currentTriggers.includes(trigger.value)}
                                onValueChange={() => toggleTrigger(trigger.value)}
                                trackColor={{ false: "#ccc", true: "#81b0ff" }}
                                thumbColor={currentTriggers.includes(trigger.value) ? "#007aff" : "#f4f3f4"}
                            />
                        </View>
                        ))}
                    </View>
                    {/* Notifications frequency */}
                    <View className="order-b mb-4 border-gray-800">
                        <Text className="text-white text-sm mb-1">How frequently do you want to be notified?</Text>
                        {frequencyOptions.map(freqOption => (
                            <View key={freqOption.value} className="flex-row items-center justify-between py-2">
                            <Text className="text-white capitalize font-thin">{freqOption.label}</Text>
                            <Switch
                                value={currentOffsets.includes(freqOption.value)}
                                onValueChange={() => toggleFrequency(freqOption.value)}
                                trackColor={{ false: "#ccc", true: "#81b0ff" }}
                                thumbColor={currentOffsets.includes(freqOption.value) ? "#007aff" : "#f4f3f4"}
                            />
                        </View>
                        ))}
                    </View>

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
            </ScrollView>
        </>
    );
}