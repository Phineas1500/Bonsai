import { View, Text, Button, TouchableOpacity, Alert, Switch, TextInput} from 'react-native';
import { useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useUser } from '@contexts/UserContext';
import React from 'react';
import { NotificationPreferences, NotificationTrigger, useNotification } from '../contexts/NotificationContext';
import { scheduleLocalNotification, NotificationPayload } from '@components/utils/notificationAPI';

import { router } from 'expo-router';
import { auth, db } from '@/firebaseConfig';
import { signOut, updatePhoneNumber } from 'firebase/auth';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

import ChangeUsernameModal from '@components/ChangeUsernameModal';
import DeleteAccountModal from '@components/DeleteAccountModal';
import { ScrollView } from 'react-native-gesture-handler';

import { getUserChats, sendMessage } from '@components/utils/chatManagement';
import { Message } from '@components/chat';


export interface AdditionalSettings {
    hideAchievements?: boolean;
}

export default function Settings() {
    const { userInfo, setUserInfo, updateUserInfo } = useUser();
    const [changeUsernamePrompt, setChangeUsernamePrompt] = useState(false);
    const [deleteAccountPrompt, setDeleteAccountPrompt] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState("");

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

    const { enableNotifications, expoPushToken, notifications, error, updateNotificationPreferences, notificationPreferences } = useNotification();

    useEffect(() => {
        if (response?.type === 'success') {
            const authObj = response.authentication;
            if (!authObj) {
                console.error("Auth object is null!");
                return;
            }
            console.log("Auth Successful:", authObj);

            const newUserInfo = {
                ...(userInfo ?? { username: "", email: "", usesGoogle: false, createdAt: new Date().toISOString(), uses2FA: undefined  }),
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
    const toggleNotifications = async () => {
        if (!userInfo?.email) {
            console.error("User email isn't available");
            return;
        }

        const newVal: boolean = !notificationPreferences.notificationsEnabled;

        //if enabling notifications, request that
        if (newVal) {
            await enableNotifications();
        }

        const newPrefs: Partial<NotificationPreferences> = {
            notificationsEnabled: newVal
        }
        await updateNotificationPreferences({ ...newPrefs }, userInfo?.email);
    }

    //handle selecting the type of notifications
    const currentTriggers = notificationPreferences.triggers;

    const triggerOptions = [
        { label: "Tasks", value: NotificationTrigger.Tasks },
        { label: "Friend Requests", value: NotificationTrigger.FriendRequests },
        { label: "Project Invites", value: NotificationTrigger.ProjectInvites },
    ]

    const toggleTrigger = (trigger: NotificationTrigger) => {
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
        { label: "1 day before", value: 1440 },
        { label: "Halfway to due date", value: -1 }
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

    // *
    // * OTHER SETTINGS FUNCTIONS (not notifs)
    // *

    // disable achievements from showing from public profile
    const hiddenAchievements = userInfo?.additionalSettings?.hideAchievements || false;
    const hideAchievements = async () => {
        if (!userInfo?.email) {
            console.error("no email??? hideAchievements()");
            return;
        }

        try {
            const oldVal = userInfo.additionalSettings?.hideAchievements || false;

            const docRef = doc(db, "users", userInfo.email);
            await updateDoc(docRef, {
                additionalSettings: {
                    ...userInfo.additionalSettings,
                    hideAchievements: !oldVal
                }
            });

            updateUserInfo({
                additionalSettings: {
                    ...userInfo.additionalSettings,
                    hideAchievements: !oldVal
                }
            });
            Alert.alert("Success", "Achievements visibility updated successfully.");
        } catch (error) {
            console.error("hideAchievements():", error);
        }
    };

    const updatePhoneNumber = async () => {
        try {
            //validate
            if (phoneNumber.length == 0) return;
            if (phoneNumber.length != 10) {
                alert("Phone number must have 10 digits!");
                return;
            }

            //set new phone number
            if (!userInfo) {
                console.error("user info undefined in settings");
                return;
            }

            await updateDoc(doc(db, "users", userInfo.email), {
                phoneNumber: "+1" + phoneNumber
            });
            updateUserInfo({
                phoneNumber: "+1" + phoneNumber
            })

        } catch (error: any) {
            console.error(error);
        }
    }

    const toggle2FA = async () => {
        if (!userInfo) {
            console.error("User isn't avaialble in settings");
            return;
        }
        if (!userInfo.phoneNumber) {
            alert("Must first set phone number before you can enable 2FA");
            return;
        }

        try {
            const currVal = userInfo.uses2FA ?? false;
            const newVal = !currVal;

            await updateDoc(doc(db, "users", userInfo.email), {
                uses2FA: newVal
            });
            updateUserInfo({
                uses2FA: newVal
            });
        } catch (error: any) {
            console.error(error);
        }
    }

    // Function to schedule the check-in notification
    const scheduleCheckInNotification = async () => {
        if (!userInfo?.email) {
            Alert.alert("Error", "User information not available.");
            console.error("Cannot schedule notification without user email.");
            return;
        }

        const triggerTime = new Date(Date.now() + 5 * 1000); // 5 seconds from now

        const notificationPayload: NotificationPayload = {
            email: userInfo.email, // Needed for potential future use, not strictly for local scheduling
            title: "Check-in Reminder",
            body: "How are your tasks going? Open Bonsai to check in.",
            triggerTime: triggerTime.toISOString(),
            data: {
                targetScreen: '/screens/chat' // Data to indicate where to navigate
            }
        };

        // send checking message from bot's perspective
        const checkInMessage: Message = {
            id: Math.random().toString(36).substring(2, 15),
            text: "How are your tasks going? Any new updates or challenges?",
            sender: "bot",
            senderUsername: "Bonsai",
            timestamp: Timestamp.fromDate(new Date()),
        };

        getUserChats(userInfo.email).then(chats => {
            const id = chats[0]?.id;
            sendMessage(id, checkInMessage).then(() => {
                console.log("CHECK IN MESSAGE SENT");
            }
            ).catch(error => {
                console.error("Error sending check-in message:", error);
            });
        }).catch(error => {
            console.error("Error fetching user chats:", error);
        });


        try {
            const notificationId = await scheduleLocalNotification(notificationPayload);
            if (notificationId) {
                Alert.alert("Success", "Check-in notification scheduled in 5 seconds.");
                console.log(`Scheduled check-in notification with ID: ${notificationId}`);
            } else {
                    Alert.alert("Info", "Check-in notification was not scheduled (likely because the time was in the past).");
            }
        } catch (error) {
            console.error("Failed to schedule check-in notification:", error);
            Alert.alert("Error", "Failed to schedule check-in notification.");
        }

    };


    return (
        <>
            <ScrollView className='flex-1 bg-stone-950'>
                <View className="flex-1 flex-col items-start p-6">
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

                    {/* 2fa settings */}
                    <View className="w-full mb-6">
                        <Text className="text-white text-lg border-b border-gray-800 py-3 ">Two-Factor Authentication</Text>
                        <Text className="text-white mb-2 mt-2">Current phone number: {userInfo?.phoneNumber || 'Not set'}</Text>
                        <TextInput
                            placeholder="Phone Number"
                            className="bg-gray-300 text-gray-600 w-full rounded-xl py-3 px-3 mb-2"
                            editable={true}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                        />
                        <Button
                            title="Set Phone Number"
                            onPress={updatePhoneNumber}
                        />

                        <View className="flex-row items-center justify-between mb-4 border-b border-gray-800 py-3">
                            <Text className="text-white text-sm font-thin ">2FA Enabled:</Text>
                            <Switch
                                trackColor={{ false: "#ccc", true: "#81b0ff" }}
                                thumbColor={userInfo?.uses2FA ? "#007aff" : "#f4f3f4"}
                                ios_backgroundColor="#ccc"
                                onValueChange={toggle2FA}
                                value={userInfo?.uses2FA ?? false}
                            />
                        </View>

                    </View>

                    <View className="w-full mb-6">
                        <Text className="text-white text-lg border-b border-gray-800 py-3 ">Notifications</Text>
                        {/* Notifications toggle */}
                        <View className="flex-row items-center justify-between mb-4 border-b border-gray-800 py-3">
                            <Text className="text-white text-sm font-thin ">Notifications enabled:</Text>
                            <Switch
                                trackColor={{ false: "#ccc", true: "#81b0ff" }}
                                thumbColor={notificationPreferences.notificationsEnabled ? "#007aff" : "#f4f3f4"}
                                ios_backgroundColor="#ccc"
                                onValueChange={toggleNotifications}
                                value={notificationPreferences.notificationsEnabled}
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
                        {/* Priority-based notifications */}
                        <View className="border-b mb-4 border-gray-800">
                            <Text className="text-white font-bold text-sm mb-1">Priority-based notifications</Text>
                            <View className="flex-row items-center justify-between py-2">
                                <View>
                                    <Text className="text-white font-thin">Enable priority-based notifications</Text>
                                    {/* <Text className="text-gray-400 text-xs">
                                        This will schedule notifications based on event priority:
                                    </Text> */}
                                    <Text className="text-gray-400 text-xs">Low priority: 1 hour before</Text>
                                    <Text className="text-gray-400 text-xs">Medium priority: 4 hours and 30 minutes before</Text>
                                    <Text className="text-gray-400 text-xs">High priority: 1 day, 4 hours, and 15 minutes before</Text>
                                </View>
                                <Switch
                                    value={notificationPreferences.priorityNotificationsEnabled}
                                    onValueChange={() => {
                                        if (!userInfo?.email) return;
                                        updateNotificationPreferences({
                                            priorityNotificationsEnabled: !notificationPreferences.priorityNotificationsEnabled
                                        }, userInfo.email);
                                    }}
                                    trackColor={{ false: "#ccc", true: "#81b0ff" }}
                                    thumbColor={notificationPreferences.priorityNotificationsEnabled ? "#007aff" : "#f4f3f4"}
                                />
                            </View>
                        </View>
                    </View>



                    <View className="w-full mb-6">
                        <Text className="text-white text-lg border-b border-gray-800 py-3 ">Additional Settings</Text>
                        {/* Notifications toggle */}
                        <View className="flex-row items-center justify-between mb-4 border-b border-gray-800 py-3">
                            <Text className="text-white text-sm font-thin ">Hide achievements on your public profile</Text>
                            <Switch
                                trackColor={{ false: "#ccc", true: "#81b0ff" }}
                                thumbColor={hiddenAchievements ? "#007aff" : "#f4f3f4"}
                                ios_backgroundColor="#ccc"
                                onValueChange={() => hideAchievements()}
                                value={hiddenAchievements}
                            />
                        </View>
                    </View>

                    <View className="w-full mb-6">
                        <Button
                            title="Send Check-In Notification"
                            onPress={scheduleCheckInNotification} // Use the new handler
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
            </ScrollView>
        </>
    );
}