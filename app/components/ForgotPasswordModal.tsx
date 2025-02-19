import { Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import GradientButton from './GradientButton';

interface ForgotPasswordModalProps {
  visible: boolean;
  onRequestClose: () => void;
}

export default function ForgotPasswordModal({
  visible,
  onRequestClose
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')

  return (
    <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={onRequestClose}
    >
      <View className="flex-1 mt-[35vh] items-center">
        <View className="bg-gray-700 w-5/6 p-4 rounded-lg">
          <Text className="text-white text-2xl font-bold">Forgot your password?</Text>
          <Text className="text-white my-1">Enter your email and we'll send you a link to reset your password.</Text>
          <View className="flex-col items-center mt-2">
            <TextInput
              placeholder="Email"
              className="bg-gray-300 text-gray-600 w-4/5 rounded-xl py-3 px-3"
              editable={true}
              value={email}
              onChangeText={setEmail}
            />
            <GradientButton
              text='RESET'
              onPress={onRequestClose}
              containerClassName="w-4/5 mt-2"
            />
            <TouchableOpacity
              className="rounded-xl"
              onPress={onRequestClose}
            >
              <Text className="text-white font-bold text-md mt-3">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}