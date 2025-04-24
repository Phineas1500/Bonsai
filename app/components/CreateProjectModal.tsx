import { Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import GradientButton from '@components/GradientButton';
import { BlurView } from 'expo-blur';
import { createProject } from './utils/projectManagement';
import { auth } from '@/firebaseConfig';

interface CreateProjectModalProps {
  visible: boolean;
  onRequestClose: () => void;
}

export default function CreateProjectModal({
  visible,
  onRequestClose
}: CreateProjectModalProps) {
  const currentUser = auth.currentUser;
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');

  const createNewProject = async () => {
    try {
      if (!currentUser?.email) return;
      if (projectName.length <= 0) {
        throw new Error('Enter a project name');
      }

      const created = await createProject(currentUser.email, projectName);

      if (!created) {
        throw new Error('Error creating project');
      }
      onRequestClose();
    } catch (err: any) {
      setError(err.message);
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
        <View className="flex-1 mt-[35vh] items-center">
          <View className="bg-stone-900 w-5/6 p-4 rounded-lg">
            <Text className="text-white text-2xl font-bold">Enter a Project Name:</Text>
            <View className="flex-col items-center mt-2 w-full">
              {error ? <Text className="text-red-500 mb-2">{error}</Text> : null}
              <TextInput
                placeholder="Project name"
                className="bg-gray-300 text-gray-600 w-full rounded-xl py-3 px-3"
                editable={true}
                value={projectName}
                onChangeText={setProjectName}
              />
              <GradientButton
                text='CREATE PROJECT'
                onPress={createNewProject}
                containerClassName="w-full mt-2"
              />
              <TouchableOpacity
                className="rounded-xl w-full items-center"
                onPress={() => {
                  setProjectName('');
                  setError('');
                  onRequestClose();
                }}
              >
                <Text className="text-white font-bold text-md mt-3">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}