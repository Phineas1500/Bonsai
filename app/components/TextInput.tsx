import { TextInput as RNTextInput } from 'react-native';

interface TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  classStyle?: string;
}

export default function TextInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  classStyle = ''
}: TextInputProps) {
  return (
    <RNTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#6B7280"
      secureTextEntry={secureTextEntry}
      className={`w-full h-[52px] bg-transparent border border-gray-700 rounded-2xl px-4 text-white ${classStyle}`}
      textAlign='left'
      textAlignVertical='center'
      style={{
        lineHeight: -52,
        height: 52,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    />
  );
}
