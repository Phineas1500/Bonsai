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
};



export const scheduleLocalNotification = async (notification: NotificationPayload) => {
    if (!notification.triggerTime) {
        console.error("Notification must have trigger time");
        return;
    }
    
    const notificationID = await Notifications.scheduleNotificationAsync({
        content: {
            title: notification.title,
            body: notification.body,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(notification.triggerTime) //date object from ISO string
        },
    });

    const dateObj = new Date(notification.triggerTime);

    console.log("scheduled notification for ", dateObj.toLocaleTimeString(), "with id: ", notificationID);
    
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
        return true;
    } catch (error: any) {
        console.error("Error sending push notification:", error);
        return false;
    }
}