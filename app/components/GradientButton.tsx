import { TouchableOpacity, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientButtonProps {
  onPress: () => void;
  text: string;
  textClassName?: string;
  containerClassName?: string;
  disabled?: boolean;
  outline?: boolean;
}

export default function GradientButton({
  onPress,
  text,
  textClassName = '',
  containerClassName = '',
  disabled = false,
  outline = false
}: GradientButtonProps) {
  return (
    <View className={`w-full ${containerClassName}`}>
      {!outline && (
        <View className="absolute top-[3px] -left-[3px] w-full rounded-2xl bg-[#006b62] h-full" />
      )}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="w-full rounded-2xl overflow-hidden"
        disabled={disabled}
      >
        <LinearGradient
          colors={['cyan', '#039455']}
          start={{ x: 1, y: -1 }}
          end={{ x: 0, y: 3 }}
          className={outline ? "p-[2px] rounded-2xl" : ""}
        >
          {outline ? (
            <View className="bg-stone-950 rounded-2xl">
              <View className="py-3 px-6 items-center justify-center">
                <Text className={`text-white font-semibold ${textClassName}`}>
                  {text}
                </Text>
              </View>
            </View>
          ) : (
            <View className="py-3 px-6 items-center justify-center">
              <Text className={`text-white font-semibold ${textClassName}`}>
                {text}
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}
