import { Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import GradientButton from '@components/GradientButton';
import { changeUsername } from '@components/utils/userManagement';

interface ForgotPasswordModalProps {
  currentUsername: string;
  visible: boolean;
  onRequestClose: () => void;
}

export default function ChangeUsernameModal({
  currentUsername,
  visible,
  onRequestClose
}: ForgotPasswordModalProps) {
  const [username, setUsername] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState('');

  // change username in firestore
  const usernameChange = async () => {
    try {
        const changed = await changeUsername(currentUsername, username);
        console.log(changed)
        if (changed.success) {
          setRequestSent(true);
        }
        else {
          throw new Error(changed.error);
        }
      } catch (err: any) {
        setError(err.message);
        // console.error(err.message);
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
          <Text className="text-white text-2xl font-bold">Enter a New Username:</Text>
          {requestSent ? (
            <View>
              <Text className="text-white my-1">Username has been changed to <Text className="font-bold">{username}</Text></Text>          
              <TouchableOpacity
                className="rounded-xl items-center"
                onPress={() => {
                  setRequestSent(false);
                  setUsername('');
                  setError('');
                  onRequestClose();
                }}
              >
                <Text className="text-white font-bold text-md mt-3">Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-col items-center mt-2">
              {error ? <Text className="text-red-500 mb-2">{error}</Text> : null}
              <TextInput
                placeholder="New username"
                className="bg-gray-300 text-gray-600 w-4/5 rounded-xl py-3 px-3"
                editable={true}
                value={username}
                onChangeText={setUsername}
              />
              <GradientButton
                text='CHANGE USERNAME'
                onPress={usernameChange}
                containerClassName="w-4/5 mt-2"
              />
              <TouchableOpacity
                className="rounded-xl"
                onPress={() => {
                    setUsername('');
                    setError('');
                    onRequestClose();
                }}
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