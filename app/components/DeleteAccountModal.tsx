import { Modal, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import GradientButton from './GradientButton';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { deleteUserAccount } from '@components/utils/userManagement';
import { getAuth, signOut } from 'firebase/auth';
import { router } from 'expo-router';

interface DeleteAccountModalProps {
  visible: boolean;
  onRequestClose: () => void;
}

export default function DeleteAccountModal({
  visible,
  onRequestClose
}: DeleteAccountModalProps) {
  const [accountDeletionConfirmation, setAccountDeletionConfirmation] = useState(false);

  // delete account in firebase auth and firestore db
  const deleteAccount = async () => {
    try {
      await deleteUserAccount();
      await signUserOut();
    } catch (err: any) {
      // Alert.alert('Error', err.message);
      console.error(err.message);
    }
  }

  // sign out user
  const signUserOut = async () => {
    const auth = getAuth();
    await signOut(auth).then(() => {
      router.push('/screens/welcome');
    })
  }

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <BlurView intensity={20} className="absolute w-full h-full">
        {accountDeletionConfirmation ? (
          <View className="flex-1 mt-[35vh] items-center">
            <View className="bg-stone-900 w-5/6 p-4 rounded-lg">
              <Text className="text-white text-2xl font-bold">Confirm account deletion</Text>
              <View className="flex-col items-center mt-2 w-full">
                <Text className="text-white my-1 mb-1">Click CONFIRM ACCOUNT DELETION to delete your account</Text>
                <GradientButton
                  text='CONFIRM ACCOUNT DELETION'
                  onPress={async () => {
                    setAccountDeletionConfirmation(false);
                    onRequestClose();
                    await deleteAccount();
                  }}
                  containerClassName="w-full mt-2"
                />
                <TouchableOpacity
                  className="rounded-xl w-full items-center"
                  onPress={() => {
                    setAccountDeletionConfirmation(false);
                    onRequestClose();
                  }}
                >
                  <Text className="text-white font-bold text-md mt-6">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View className="flex-1 mt-[35vh] items-center">
            <View className="bg-stone-900 w-5/6 p-4 rounded-lg">
              <Text className="text-white text-2xl font-bold">Are you sure you want to delete your account?</Text>
              <View className="flex-col items-center mt-2 w-full">
                <Text className="text-white my-1 mb-1">Deleting an account is final. This action CANNOT be undone</Text>
                <GradientButton
                  text='YES, DELETE ACCOUNT'
                  onPress={() => setAccountDeletionConfirmation(true)}
                  containerClassName="w-full mt-2"
                />
                <TouchableOpacity
                  className="rounded-xl w-full items-center"
                  onPress={() => {
                    setAccountDeletionConfirmation(false);
                    onRequestClose();
                  }}
                >
                  <Text className="text-white font-bold text-md mt-6">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </BlurView>
    </Modal>
  );
}