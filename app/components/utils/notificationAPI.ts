import axios from 'axios';
import { getUserByEmail } from './userManagement';
import * as Notifications from "expo-notifications";
import { TaskNotification } from '@/app/contexts/NotificationContext';

export interface NotificationPayload {
    email: string,
    title: string,
    body: string,
    data: Record<string, any>
    triggerTime?: string //ISO string
    priority?: number; // Add priority to notification payload
};

// Define priority offset mapping (in minutes)
export const PRIORITY_NOTIFICATION_OFFSETS = {
    LOW: [60], // 1 hour before for low priority (1-4)
    MEDIUM: [240, 30], // 4 hours and 30 minutes before for medium priority (5-7)
    HIGH: [1440, 240, 15], // 1 day, 4 hours, and 15 minutes before for high priority (8-10)
};

// Helper to get priority offsets based on priority score
export const getPriorityOffsets = (priority: number): number[] => {
    if (priority >= 8) return PRIORITY_NOTIFICATION_OFFSETS.HIGH;
    if (priority >= 5) return PRIORITY_NOTIFICATION_OFFSETS.MEDIUM;
    return PRIORITY_NOTIFICATION_OFFSETS.LOW;
};

// Helper to get priority label for notification
export const getPriorityLabel = (priority: number): string => {
    if (priority >= 8) return "High Priority";
    if (priority >= 5) return "Medium Priority";
    return "Low Priority";
};

export const scheduleLocalNotification = async (notification: NotificationPayload) => {
    if (!notification.triggerTime) {
        console.error("Notification must have trigger time");
        return;
    }
    
    const triggerDate = new Date(notification.triggerTime);
    const now = new Date();
    
    // Skip notifications in the past
    if (triggerDate <= now) {
        console.log(`Skipping notification for "${notification.title}" as the time (${triggerDate.toLocaleTimeString()}) has already passed`);
        return;
    }
    
    // Prepare notification content with priority label if available
    const notificationContent: Notifications.NotificationContentInput = {
        title: notification.title,
        body: notification.body,
        data: notification.data || {}
    };
    
    // Add priority label to notification if priority is provided
    if (notification.priority !== undefined) {
        const priorityLabel = getPriorityLabel(notification.priority);
        notificationContent.title = `${priorityLabel}: ${notification.title}`;
        
        // Add priority to data for the app to use if needed
        notificationContent.data = {
            ...notificationContent.data,
            priority: notification.priority
        };
    }
    
    const notificationID = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate
        },
    });

    console.log("scheduled notification for ", triggerDate.toLocaleTimeString(), "with id: ", notificationID);
    
    return notificationID;
}

export const cancelLocalNotification = async (scheduledNotif: TaskNotification) => {
    try {
        const id = scheduledNotif.notificationId;
        await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error: any) {
        console.error("Error updating scheduled task notifications", error);
    }
}

export const sendPushNotification = async (notification: NotificationPayload) => {

    //fetch their expo push token from firebase 
    let expoPushToken: string | null = null;
    try {
        //console.log("email", notification?.email);
        const userSnapshot = await getUserByEmail(notification.email);
        if (!userSnapshot) {
            console.error("User not found:", notification.email);
            return false;
        }
        expoPushToken = userSnapshot.data().expoPushToken;
        if (!expoPushToken) {
            console.error("User has no push token:", notification.email);
            return false;
        }
    } catch (error: any) {
        console.error("Error fetching user's expo push token:", error);
        return false;
    }

    //send push notification
    try {
        const payload = {
            to: expoPushToken,
            sound: "default",
            title: notification.title,
            body: notification.body,
            data: notification.data,
        };
        const endpoint = "https://exp.host/--/api/v2/push/send";
        const config = {
            headers: {
                Accept: "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
        };
        const response = await axios.post(endpoint, payload, config);
        console.log("Push notification sent successfully:", response.data);
        //console.log("Expo push token: ", expoPushToken);
        return true;
    } catch (error: any) {
        console.error("Error sending push notification:", error);
        return false;
    }
}