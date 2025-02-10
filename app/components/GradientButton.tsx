import { TouchableOpacity, Text } from 'react-native';
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`w-full rounded-xl overflow-hidden ${containerClassName}`}
    >
      <LinearGradient
        colors={['#43e6d4', '#039455']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        className="py-3 px-6 items-center justify-center"
      >
        <Text
          className={`text-white font-semibold text-lg ${textClassName}`}
        >
          {text}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
