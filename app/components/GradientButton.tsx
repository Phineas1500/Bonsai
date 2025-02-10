import { TouchableOpacity, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientButtonProps {
  onPress: () => void;
  text: string;
  textClassName?: string;
  containerClassName?: string;
}

export default function GradientButton({
  onPress,
  text,
  textClassName = '',
  containerClassName = ''
}: GradientButtonProps) {
  return (
    <View className={`w-full ${containerClassName}`}>
      <View className="absolute top-[3px] -left-[3px] w-full rounded-2xl bg-[#006b62] h-full" />
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="w-full rounded-2xl overflow-hidden"
      >
        <LinearGradient
          colors={['cyan', '#039455']}
          start={{ x: 1, y: -1 }}
          end={{ x: 0, y: 3 }}
          className="py-3 px-6 items-center justify-center rounded-2xl"
        >
          <Text className={`text-white font-semibold text-lg ${textClassName}`}>
            {text}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}
