import { Modal, View, Text, TouchableOpacity } from 'react-native';
import GradientButton from './GradientButton';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { deleteProject } from './utils/projectManagement';

interface DeleteProjectModalProps {
  email: string | undefined;
  projectId: string | undefined;
  visible: boolean;
  onRequestClose: () => void;
}

export default function DeleteProjectModal({
  email,
  projectId,
  visible,
  onRequestClose
}: DeleteProjectModalProps) {
  // delete project in firestore db
  const deleteAccount = async () => {
    try {
      if (email === undefined || projectId === undefined) {
        throw new Error('Email or projectId undefined')
      }
      await deleteProject(email, projectId);
      router.push('/screens/social');
    } catch (err: any) {
      console.error(err.message);
    }
  }

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <BlurView intensity={20} className="absolute w-full h-full">
        <View className="flex-1 mt-[25vh] items-center">
          <View className="bg-stone-900 w-5/6 p-4 rounded-lg">
            <Text className="text-white text-2xl font-bold">Are you sure you want to delete this project?</Text>
            <View className="flex-col items-center mt-2 w-full">
              <Text className="text-white my-1 mb-1">Deleting a project is final and will delete the project for all members. This action CANNOT be undone.</Text>
              <GradientButton
                text='YES, DELETE PROJECT'
                onPress={deleteAccount}
                containerClassName="w-full mt-2"
              />
              <TouchableOpacity
                className="rounded-xl w-full items-center"
                onPress={() => {
                  onRequestClose();
                }}
              >
                <Text className="text-white font-bold text-md mt-6">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}