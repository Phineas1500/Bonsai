import { Image, Text, View } from "react-native";
import { Achievement } from "./utils/achievementManagement";

interface AchievementItemProps extends Achievement {
  classStyle?: string;
}

export default function AchievementItem({
  url,
  title,
  description,
  classStyle
}: AchievementItemProps) {
  return (
    <View className={`bg-[#1D1D1D] h-34 w-32 rounded-2xl items-center p-2 ${classStyle}`}>
      <Image
        source={{ uri: `https://api.dicebear.com/9.x/shapes/png?seed=${title}` }}
        className="h-12 w-12 rounded-full object-cover bg-white mb-1"
        resizeMode="contain"
      />
      <Text className="text-white text-center font-bold mb-1">{title}</Text>
      <Text className="text-xs text-center text-gray-400">{description}</Text>
    </View>
  );
}