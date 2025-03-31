import { TextInput } from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  classStyle?: string;
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  classStyle
}: SearchBarProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#6B7280"
      secureTextEntry={secureTextEntry}
      className={`w-full h-11 bg-transparent border border-gray-500 rounded-2xl px-4 text-white ${classStyle}`}
      textAlign='left'
      textAlignVertical='center'
    />
  );
}
