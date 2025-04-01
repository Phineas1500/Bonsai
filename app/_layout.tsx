import React from 'react';
import { Stack, usePathname } from 'expo-router';

import { UserProvider } from './contexts/UserContext';
import { TasksProvider } from './contexts/TasksContext';
import Navbar from './components/Navbar';
import * as Notifications from "expo-notifications";
import { NotificationProvider } from './contexts/NotificationContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const pathname = usePathname();

  // List of routes where Navbar should not be displayed
  const hideNavbarRoutes = [
    '/screens/welcome',
    '/screens/signin',
    '/screens/signup',
    '/screens/authcallback',
  ];

  // Check if current route should hide navbar
  const shouldShowNavbar = !hideNavbarRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  return (
    <NotificationProvider>
      <UserProvider>
        <TasksProvider>
          {shouldShowNavbar && <Navbar />}
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'none',
            }}
          />
        </TasksProvider>
      </UserProvider>
    </NotificationProvider>
  );
}