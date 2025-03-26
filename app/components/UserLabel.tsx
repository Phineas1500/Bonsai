import { Image, Text, TouchableOpacity, View } from "react-native";

interface UserLabelProps {
  onPress?: () => void;
  username: string;
  disabled?: boolean;
}

export default function UserLabel({
  onPress,
  username,
  disabled = false
}: UserLabelProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-[#1D1D1D] h-14 w-full rounded-2xl justify-center"
      disabled={disabled}
    >
      <View className="flex-row items-center mx-4">
        <Image
          source={require('@assets/images/bonsai-logo.png')}
          className="h-9 w-9 rounded-full object-cover bg-white"
          resizeMode="contain"
        />
        <Text className="text-white ml-4 text-md">{username}</Text>
      </View>
    </TouchableOpacity>
  );
}
