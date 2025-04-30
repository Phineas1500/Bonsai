import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'; // Added ActivityIndicator
import { useState } from 'react';
import GradientButton from '@components/GradientButton';
import { BlurView } from 'expo-blur';
import { createProject } from './utils/projectManagement';
import { auth } from '@/firebaseConfig';
import { useUser } from '@contexts/UserContext'; // Import useUser

interface CreateProjectModalProps {
  visible: boolean;
  onRequestClose: () => void;
}

export default function CreateProjectModal({
  visible,
  onRequestClose
}: CreateProjectModalProps) {
  const currentUser = auth.currentUser;
  const { userInfo } = useUser(); // Get userInfo from context
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Add loading state

  const createNewProject = async () => {
    setError('');
    setIsLoading(true); // Start loading
    try {
      if (!currentUser?.email) {
        throw new Error('User not logged in');
      };
      if (projectName.trim().length <= 0) {
        throw new Error('Enter a project name');
      }

      // Pass calendarAuth to createProject
      const created = await createProject(
        currentUser.email,
        projectName.trim(),
        userInfo?.calendarAuth // Pass the calendar auth object
      );

      if (!created) {
        // Error might have been logged in createProject, provide generic message
        throw new Error('Error creating project. Check console for details.');
      }
      setProjectName(''); // Clear name on success
      onRequestClose(); // Close modal on success
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false); // Stop loading
    }
  }

  // Function to handle closing the modal and resetting state
  const handleClose = () => {
    setProjectName('');
    setError('');
    setIsLoading(false); // Ensure loading is reset
    onRequestClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose} // Use handleClose
    >
      <BlurView intensity={20} className="absolute w-full h-full">
        <View className="flex-1 mt-[35vh] items-center">
          {/* Use bg-stone-800 for consistency? */}
          <View className="bg-stone-800 w-5/6 p-5 rounded-lg shadow-lg">
            <Text className="text-white text-xl font-bold mb-4 text-center">Create New Project</Text>
            <View className="flex-col items-center w-full">
              {error ? <Text className="text-red-500 mb-2 text-center">{error}</Text> : null}
              <TextInput
                placeholder="Project name"
                // Use className instead of classStyle
                className="bg-stone-700 text-white w-full rounded-lg py-3 px-4 mb-4"
                placeholderTextColor="#9CA3AF" // Gray-400
                editable={!isLoading} // Disable while loading
                value={projectName}
                onChangeText={setProjectName}
              />
              <GradientButton
                text={isLoading ? 'Creating...' : 'CREATE PROJECT'}
                onPress={createNewProject}
                containerClassName="w-full"
                disabled={isLoading} // Disable button while loading
              />
              {isLoading && <ActivityIndicator size="small" color="#ffffff" style={{ marginTop: 8 }} />}
              <TouchableOpacity
                className="mt-4"
                onPress={handleClose} // Use handleClose
                disabled={isLoading} // Disable while loading
              >
                <Text className="text-gray-400 font-semibold text-md">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}