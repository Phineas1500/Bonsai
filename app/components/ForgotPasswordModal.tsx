import { Modal, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import GradientButton from './GradientButton';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from 'firebaseConfig';

interface ForgotPasswordModalProps {
  visible: boolean;
  onRequestClose: () => void;
}

export default function ForgotPasswordModal({
  visible,
  onRequestClose
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')
  const [requestSent, setRequestSent] = useState(false)

  // reset password in firebase auth
  const resetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, email)
        .then(() => setRequestSent(true))
    } catch (err: any) {
      Alert.alert('Error', 'Please enter a valid email');
      console.log(err.message)
    }
  }

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
          {requestSent ? (
            <View>
              <Text className="text-white my-1">An email with instructions to reset your password has been sent.</Text>          
              <TouchableOpacity
                className="rounded-xl items-center"
                onPress={() => {
                  setRequestSent(false);
                  setEmail('');
                  onRequestClose();
                }}
              >
                <Text className="text-white font-bold text-md mt-3">Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-col items-center mt-2">
              <Text className="text-white my-1">Enter your email and we'll send you a link to reset your password.</Text>          
              <TextInput
                placeholder="Email"
                className="bg-gray-300 text-gray-600 w-4/5 rounded-xl py-3 px-3"
                editable={true}
                value={email}
                onChangeText={setEmail}
              />
              <GradientButton
                text='RESET'
                onPress={resetPassword}
                containerClassName="w-4/5 mt-2"
              />
              <TouchableOpacity
                className="rounded-xl"
                onPress={onRequestClose}
              >
                <Text className="text-white font-bold text-md mt-3">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}