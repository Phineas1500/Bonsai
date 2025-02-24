import { Stack } from 'expo-router';
import { UserProvider } from "./contexts/UserContext";

export default function RootLayout() {

  return (
    <UserProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
        />
    </UserProvider>
  );
}
