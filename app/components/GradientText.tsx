import { Text, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';

interface GradientTextProps {
  text: string;
  className?: string;
}

export default function GradientText({ text, className = '' }: GradientTextProps) {
  return (
    <MaskedView
      style={{ flexDirection: 'row' }}
      maskElement={
        <Text className={className} style={{ backgroundColor: 'transparent' }}>
          {text}
        </Text>
      }
    >
      <View style={{ flex: 1, backgroundColor: '#00a8b1' }} />
      <View style={{ flex: 1, backgroundColor: '#008e68' }} />
    </MaskedView>
  );
}
