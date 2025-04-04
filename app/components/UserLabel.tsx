import { Feather } from "@expo/vector-icons";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useUser } from "../contexts/UserContext";

interface UserLabelProps {
  onPress?: () => void;
  username: string;
  disabled?: boolean;
  classStyle?: string;
  friend?: boolean;
  me?: boolean;
}

export default function UserLabel({
  onPress,
  username,
  disabled = false,
  classStyle,
  friend = false,
  me = false
}: UserLabelProps) {
  const {userInfo} = useUser();
  const seed = encodeURIComponent(username);
  const avatarUrl = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${seed}`
  console.log(avatarUrl);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`bg-[#1D1D1D] h-14 w-full rounded-2xl justify-center ${classStyle}`}
      disabled={disabled}
    >
      <View className="flex-row items-center mx-4">
        <Image
          source={{ uri: avatarUrl }}
          className="h-9 w-9 rounded-full object-cover bg-white"
          resizeMode="contain"
        />
        {me ? (
          <Text className="text-white ml-4 mr-2 text-md font-bold">{username} (me)</Text>
        ) : (
          <Text className="text-white ml-4 mr-2 text-md">{username}</Text>
        )}
        {friend && <Feather name="users" size={18} color="gray"/>}
      </View>
    </TouchableOpacity>
  );
}
