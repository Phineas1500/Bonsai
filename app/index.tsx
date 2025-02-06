import { Text, View, Button, Alert } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 justify-center items-center">
      <Text>Sign in with Google.</Text>
      <Button
        title="Press me"
        onPress={() => Alert.alert("Hey!")}
      />
    </View>
  );
}
