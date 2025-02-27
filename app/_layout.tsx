import React from 'react';
import { Stack } from 'expo-router';
import { UserProvider } from './contexts/UserContext';
import { TasksProvider } from './contexts/TasksContext';

export default function RootLayout() {
  return (
    <UserProvider>
      <TasksProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
          }}
        />
      </TasksProvider>
    </UserProvider>
  );
}
