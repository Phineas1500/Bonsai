import { View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import GradientButton from '@components/GradientButton';
import Navbar from '../components/Navbar';

export default function Chat() {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    console.log('Sending message:', message);
    setMessage('');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-stone-950"
    >
      <Navbar />
      <View className="flex-1 justify-between p-6">

        {/* Messages area */}
        <View>

        </View>

        {/* Input area */}
        <View className="flex-row items-center gap-2 self-end">
          <TextInput
            className="flex-1 bg-stone-800 text-white rounded-lg px-4 py-3"
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <GradientButton
            text="Send"
            onPress={handleSend}
            containerClassName="w-20"
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}