import { Text, View } from "react-native";
import GoogleSignIn from './components/GoogleSignIn';

export default function Index() {
  return (
    <View className="flex-1 justify-center items-center">
      <Text className="mb-4">Sign in with Google</Text>
      <GoogleSignIn />
    </View>
  );
}