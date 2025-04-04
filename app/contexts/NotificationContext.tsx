import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { UserInfo, useUser } from "./UserContext";
import { Platform, TaskCanceller } from "react-native";
import { db } from 'firebaseConfig';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, QuerySnapshot, setDoc, updateDoc } from "firebase/firestore";
import { useTasks } from "./TasksContext";
import { cancelLocalNotification, scheduleLocalNotification } from "../components/utils/notificationAPI";
import { NotificationPayload } from "../components/utils/notificationAPI";
import { getUserByEmail } from "../components/utils/userManagement";

interface NotificationContextType {
    enableNotifications: () => Promise<boolean | undefined>;
    expoPushToken: string | null;
    notifications: Notifications.Notification[];
    error: Error | null;
    updateNotificationPreferences: (newPrefs: Partial<NotificationPreferences>, userEmail: string) => Promise<void>;
    notificationPreferences: NotificationPreferences;
}

export interface TaskNotification {
  taskId : string;
  notificationId : string;
  triggerTime: string; //ISO string
}

//have to make sure to keep this synced with the shape of user info
export interface NotificationPreferences {
  notificationsEnabled : boolean;
  reminderOffsets : number[];
  triggers : string [];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode}) {

    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<Notifications.Notification[]>([]);
    const [error, setError] = useState<Error | null>(null);

    const notificationListener = useRef<Notifications.EventSubscription>();
    const responseListener = useRef<Notifications.EventSubscription>();

    const {userInfo, updateUserInfo} = useUser();

    const { tasks, isLoading } = useTasks();

    const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
      notificationsEnabled: false,
      reminderOffsets: [0],
      triggers: ["tasks"]
    }

    // do stuff on load
    useEffect(() => {
        getPushToken();
    }, []);

    //add new listeners if push token changes
    useEffect(() => {
        //if no expo token then return and don't add listeners 
        if (!expoPushToken) {
            return;
        }

        //also possibly schedule notifications for tasks
        updateTaskNotifications();
        
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

    }, [expoPushToken]);

    //update notification preferences if user changes
    useEffect(() => {
      fetchNotificationPreferences();
    }, [userInfo?.email])

    //add notifications for tasks
    useEffect(() => {
      console.log("user email changed: ", userInfo?.email);
      updateTaskNotifications();
    }, [tasks, userInfo?.email]);

    /**
     * fetch the server state of notification preferences for a user and update the
     * local user info context with that info. If the user exists but doesn't have any 
     * notification preferences then create default preferences
     * 
     * @returns 
     */
    const fetchNotificationPreferences = async () => {
      try {
        //if no user email then can't fetch notifications yet
        if (!userInfo?.email) return;

        //check if user has notification preferences set 
        const userDoc = await getUserByEmail(userInfo.email);
        if (!userDoc) return;

        const userInfoSnap: UserInfo = userDoc.data() as UserInfo;
        const preferences = userInfoSnap.notificationPreferences;
        if (preferences) {
          //update local user info context 
          updateUserInfo({
            notificationPreferences: {
              notificationsEnabled: preferences.notificationsEnabled,
              reminderOffsets: preferences.reminderOffsets,
              triggers: preferences.triggers
            }
          })
        } else {
          //if user doesn't have prefernces, create default ones 
          updateNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES, userInfo.email);
        }

      } catch (error: any) {
        console.error("Error fetching notification preferences", error);
      }
    }

    /**
     * updates the notification preferences locally for the user context and also in the database
     * 
     * @param newPreferences 
     * @param email 
     */
    const updateNotificationPreferences = async (newPreferences: Partial<NotificationPreferences>, email: string) => {
      try {
        const currentPrefs = userInfo?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;

        const mergedPrefs: NotificationPreferences = {
          ...currentPrefs,
          ...newPreferences
        }

        // Update the database first
        const docRef = doc(db, "users", email);
        await updateDoc(docRef, {
          notificationPreferences: mergedPrefs
        });

        // Update the local user info context
        updateUserInfo({
          notificationPreferences: mergedPrefs
        });
      
        // Pass the new merged preferences directly to avoid stale state
        await updateTaskNotifications(mergedPrefs);

      } catch (error: any) {
        console.error("Error updating notification preferences", error);
      }
    }

    /**
     * Remove all currently scheduled notifications for tasks. Check if notifications should be scheduled and schedule if so.
     * 
     * @returns 
     */
    const updateTaskNotifications = async (providedPrefs?: NotificationPreferences) => {
      // If user hasn't logged in yet then don't do anything
      if (!userInfo?.email) return;

      // Remove all current scheduled tasks for the user
      await removeScheduledNotifications(userInfo.email);

      // Use provided preferences or fall back to context state
      const notificationPreferences = providedPrefs || userInfo?.notificationPreferences;
      
      if (!notificationPreferences) {
        console.log("user doesn't have any notification preferences")
        return;
      }
      
      if (!notificationPreferences.notificationsEnabled) {
        console.log("User has notifications disabled");
        return;
      }

      //if the user shouldn't be notified of tasks, then don't do it
      if (!notificationPreferences.triggers.includes("tasks")) {
        console.log("User doesn't want to be notified about tasks");
        return;
      }

      //for each task, add a notification for that task
      const threads = tasks.map(async (taskItemData) => {
        const notifPayload: NotificationPayload = {
          email: userInfo.email,
          title: taskItemData.title,
          body: taskItemData.description,
          data: taskItemData,
          triggerTime: taskItemData.startTime //google calendar uses ISO compatible strings
        }
        return addNotificationForTask(notifPayload, taskItemData.id);
      });
      await Promise.all(threads);
    }

    /**
     * Schedules a local notification for that task that will trigger at the specified 
     * time. Adds the task notification to firebase to record that a notification for that
     * task has been scheduled. If this task is to be notified with a greater frequency 
     * then multiple notifications are set.
     * 
     * @param notification the notification payload for the notification to show
     * @param taskId the taskId given by google calendar to uniquely identify the task
     * @returns 
     */
    const addNotificationForTask = async (notification: NotificationPayload, taskId: string) => {
    
      try {
        if (!notification.triggerTime) {
          console.error("Task notification must have trigger time");
          return;
        }

        const notificationPreferences = userInfo?.notificationPreferences;
        if (!notificationPreferences) {
          console.log("Notification preferences not initialized. Can't add notifications");
          return;
        }

        //for each task to notify about, might have to create multiple notifications
        //at different offset times i.e 5 minutes before, 10 minutes before ... 
        const offsets = notificationPreferences.reminderOffsets;
        const threads = offsets.map(async (minuteOffset) => {
          if (!notification.triggerTime) return;
          const originalTime = new Date(notification.triggerTime);

          // subtract offset in milliseconds
          const newTime = new Date(originalTime.getTime() - minuteOffset * 60 * 1000);

          const newNotif: NotificationPayload = {
            email: notification.email,
            title: notification.title,
            body: notification.body, 
            data: notification.data,
            triggerTime: newTime.toISOString()
          }
          //each notification for a task will have a unique notification id and same task id
          const notificationID = await scheduleLocalNotification(newNotif);
          if (!notificationID) {
            console.error("Error scheduling notification");
            return;
          }

          //add the notification to firebase
          const taskNotification: TaskNotification = {
            taskId: taskId,
            notificationId: notificationID,
            triggerTime: newTime.toISOString()
          }
          const docRef = doc(db, "tasksToNotify", notification.email, "notifications", taskNotification.notificationId);
          await setDoc(docRef, {
            taskId: taskNotification.taskId,
            notificationId: taskNotification.notificationId,
            triggerTime: taskNotification.triggerTime
          });
          return;
        });
        await Promise.all(threads);
        
      } catch (error: any) {
        console.error("Problem adding notification for user", error);
      }

    }

    const removeScheduledNotifications = async (email: string) => {
      
      const collectionRef = collection(db, "tasksToNotify", email, "notifications");
      const docsSnapshot = await getDocs(collectionRef);

      const deletions = docsSnapshot.docs.map(async (docSnap) => {
        //delete from device notifications
        const scheduledTaskNotification = docSnap.data() as TaskNotification;
        await cancelLocalNotification(scheduledTaskNotification);

        //delete in firebase
        return deleteDoc(doc(db, "tasksToNotify", email, "notifications", docSnap.id));
      });

      //wait for all deletions to finish
      await Promise.all(deletions);
    }

    const handleRegistrationError = (errorMessage: string) => {
        alert(errorMessage);
        throw new Error(errorMessage);
    }

    const getPushToken = async () => {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            if (existingStatus === "granted") {
                const projectId =
                Constants?.expoConfig?.extra?.eas?.projectId ??
                Constants?.easConfig?.projectId;
                const pushTokenString = (
                    await Notifications.getExpoPushTokenAsync({
                        projectId,
                    })
                ).data;
                if (expoPushToken != pushTokenString) {
                    console.log("User has expo push token: ", pushTokenString);
                    setExpoPushToken(pushTokenString);
                    
                }
            }
        } catch (error: any) {
            console.error("Error getting push token status");
        }
    }

    const enableNotifications = async () => {
        //check if a user is logged in
        const userEmail = userInfo?.email;
        if (!userEmail) {
            console.error("Unable to get user info. Perhaps no user is logged in")
            return false;
        }

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
          });
        }
      
        if (Device.isDevice) {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== "granted") {
              handleRegistrationError(
                  "Permission not granted to get push token for push notification!"
              );
          }
          const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId;
          if (!projectId) {
            handleRegistrationError("Project ID not found");
          }
          try {
            const pushTokenString = (
              await Notifications.getExpoPushTokenAsync({
                projectId,
              })
            ).data;
            console.log(pushTokenString);
      
            //store push notification in database
            await storePushNotificationToken(pushTokenString, userEmail);
            setExpoPushToken(pushTokenString);

            //mark notifications as enabled
            const currentPrefs = userInfo.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;

            updateNotificationPreferences({
              ...currentPrefs,
              notificationsEnabled: true
            }, userInfo.email);

            return true;

          } catch (e: unknown) {
            handleRegistrationError(`${e}`);
          }
        } else {
          handleRegistrationError("Must use physical device for push notifications");
        }
    }

    const storePushNotificationToken = async (token : string, userEmail : string) => {
      try {
        if (!userEmail) {
          console.error("Cannot store push notification. User email unavailable.");
          return;
        }
    
        const userRef = doc(db, "users", userEmail);
        await updateDoc(userRef, {
          expoPushToken: token
        });
        console.log("Push token added successfully");
      } catch (error: any) {
        console.error("Error storing push token:", error);
      }
    }

    return (
        <NotificationContext.Provider 
        value={{
          enableNotifications, 
          expoPushToken, 
          notifications, 
          error, 
          updateNotificationPreferences,
          notificationPreferences: userInfo?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
        }}>
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