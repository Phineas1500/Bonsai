import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useUser } from "./UserContext";
import { Platform, TaskCanceller } from "react-native";
import { db } from 'firebaseConfig';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, QuerySnapshot, setDoc, updateDoc } from "firebase/firestore";
import { useTasks } from "./TasksContext";
import { cancelLocalNotification, scheduleLocalNotification } from "../components/utils/notificationAPI";
import { NotificationPayload } from "../components/utils/notificationAPI";

interface NotificationContextType {
    enableNotifications: () => Promise<void>;
    expoPushToken: string | null;
    notifications: Notifications.Notification[];
    error: Error | null;
};

export interface TaskNotification {
  taskId : string;
  notificationId : string;
  triggerTime: string //ISO string
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode}) {

    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<Notifications.Notification[]>([]);
    const [error, setError] = useState<Error | null>(null);

    const notificationListener = useRef<Notifications.EventSubscription>();
    const responseListener = useRef<Notifications.EventSubscription>();

    const {userInfo, setUserInfo} = useUser();

    const { tasks, isLoading } = useTasks();

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

    //add notifications for tasks
    useEffect(() => {
      console.log("user email changed: ", userInfo?.email);
      updateTaskNotifications();
    }, [tasks, userInfo?.email]);

    const updateTaskNotifications = async () => {
      //if user hasn't logged in yet then don't do anything
      console.log(userInfo);
      if (!userInfo?.email) return;


      //remove all current scheduled tasks for the user
      await removeScheduledNotifications(userInfo.email);

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
     * task has been scheduled.
     * 
     * @param notification the notification payload for the notification to show
     * @param taskId the taskId given by google calendar to uniquely identify the task
     * @returns 
     */
    const addNotificationForTask = async (notification: NotificationPayload, taskId: string) => {
      /**
       * In firebase, collections have to have a document, even if the document is empty. 
       * 
       * /tasksToNotify (collection)
       *    /{user email} (document, has nothing in it)
       *        /notifications (subcollection containing task notification objects)
       *            /abc123 (document with id = taskId)
       */ 
    
      try {
        if (!notification.triggerTime) {
          console.error("Task notification must have trigger time");
          return;
        }

        //schedule local notification for task
        const notificationID = await scheduleLocalNotification(notification);
        if (!notificationID) {
          console.error("Error scheduling notification");
          return;
        }

        //add the task to firebase
        const taskNotification: TaskNotification = {
          taskId: taskId,
          notificationId: notificationID,
          triggerTime: notification.triggerTime
        }
        const docRef = doc(db, "tasksToNotify", notification.email, "notifications", taskNotification.taskId);
        await setDoc(docRef, {
          taskId: taskNotification.taskId,
          notificationId: taskNotification.notificationId,
          triggerTime: taskNotification.triggerTime
        });
      } catch (error: any) {
        console.error("Problem adding notification for user", error);
      }

    }

    const removeScheduledNotifications = async (email: string) => {
      
      const collectionRef = collection(db, "tasksToNotify", email, "notifications");
      const docsSnapshot = await getDocs(collectionRef);

      const deletions = docsSnapshot.docs.map(async (docSnap) => {
        //delete from device notifications via id
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
            return;
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
        <NotificationContext.Provider value={{enableNotifications, expoPushToken, notifications, error}}>
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