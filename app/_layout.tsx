import * as Notifications from "expo-notifications";

//this is necessary to show notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

import React, { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { UserProvider } from './contexts/UserContext';
import { TasksProvider } from './contexts/TasksContext';
import Navbar from './components/Navbar';

import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUser } from './contexts/UserContext';

//this is necessary to show notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});


// Create a wrapper component to use hooks
function AppContent() {
  const { requestInitialNotificationPermissions } = useNotification();
  const { userInfo } = useUser();
  const pathname = usePathname();

  // List of routes where Navbar should not be displayed
  const hideNavbarRoutes = [
    '/screens/welcome',
    '/screens/signin',
    '/screens/signup',
    '/screens/authcallback',
  ];

  // Request notification permissions when user logs in
  useEffect(() => {
    if (userInfo?.email) {
      requestInitialNotificationPermissions();
    }
  }, [userInfo?.email]);

  // Check if current route should hide navbar
  const shouldShowNavbar = !hideNavbarRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  return (
    <>
      {shouldShowNavbar && <Navbar />}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UserProvider>
        <TasksProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </TasksProvider>
      </UserProvider>
    </GestureHandlerRootView>
  );
}