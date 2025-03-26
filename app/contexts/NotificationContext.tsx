import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import * as Notifications from "expo-notifications";
import { registerForPushNotificationsAsync } from "../components/utils/registerForPushNotificationsAsync";

interface NotificationContextType {
    expoPushToken: string | null;
    notifications: Notifications.Notification[];
    error: Error | null;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode}) {

    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<Notifications.Notification[]>([]);
    const [error, setError] = useState<Error | null>(null);

    const notificationListener = useRef<Notifications.EventSubscription>();
    const responseListener = useRef<Notifications.EventSubscription>();

    useEffect(() => {
        registerForPushNotificationsAsync()
            .then((token) => setExpoPushToken(token ?? ''))
            .catch((error: any) => setError(error)
        );
        
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log("Notification recieved: ", notification);
            setNotifications(prev => [...prev, notification]);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log(response);
        });

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            };
        };

    }, []);

    return (
        <NotificationContext.Provider value={{ expoPushToken, notifications, error}}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
};