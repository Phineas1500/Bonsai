import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

interface GradientTextProps {
  text: string;
  classStyle?: string;
  size: [number, number];
}

export default function GradientText({ text, classStyle = '', size }: GradientTextProps) {
  return (
    <MaskedView
      style={{ width: size ? size[0] : 0, height: size ? size[1] : 0 }}
      maskElement={
        <View className="items-center justify-center">
          <Text
            className={classStyle}
            style={{ color: 'white' }}
          >
            {text}
          </Text>
        </View>
      }
    >
      <LinearGradient
        colors={['#00ccd7', '#008e68']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        className="flex-1"
      />
    </MaskedView>
  );
}
