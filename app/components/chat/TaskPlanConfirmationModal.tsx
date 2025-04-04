import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { format, parseISO } from 'date-fns';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

interface TaskPlanConfirmationModalProps {
  visible: boolean;
  taskPlan: {
    title: string;
    description: string;
    subtasks: Array<{
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      priority: number;
    }>;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

const TaskPlanConfirmationModal = ({
  visible,
  taskPlan,
  onConfirm,
  onCancel
}: TaskPlanConfirmationModalProps) => {
  // Format the dates for display
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <BlurView intensity={20} className="absolute w-full h-full">
        <View className="flex-1 justify-center items-center">
          <View className="bg-stone-900 w-11/12 p-5 rounded-lg max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-2xl font-bold">Task Plan</Text>
              <TouchableOpacity onPress={onCancel} className="p-2">
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <View className="mb-4">
              <Text className="text-teal-500 font-semibold mb-1">Main Task:</Text>
              <Text className="text-white text-lg">{taskPlan.title}</Text>
            </View>
            
            {taskPlan.description ? (
              <View className="mb-4">
                <Text className="text-teal-500 font-semibold mb-1">Description:</Text>
                <Text className="text-white">{taskPlan.description}</Text>
              </View>
            ) : null}
            
            <Text className="text-teal-500 font-semibold mb-2">Subtasks:</Text>
            <ScrollView className="max-h-[300px] mb-4">
              {taskPlan.subtasks.map((subtask, index) => (
                <View key={index} className="bg-stone-800 p-3 rounded-lg mb-2">
                  <Text className="text-white font-medium">{subtask.title}</Text>
                  {subtask.description ? (
                    <Text className="text-gray-300 text-sm mb-1">{subtask.description}</Text>
                  ) : null}
                  <Text className="text-gray-400 text-xs">
                    {formatDate(subtask.startTime)} to {formatDate(subtask.endTime)}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <Text className="text-gray-400 text-xs mr-1">Priority:</Text>
                    <Text className={`text-xs ${
                      subtask.priority >= 8 ? 'text-red-500' : 
                      subtask.priority >= 6 ? 'text-amber-500' : 
                      subtask.priority >= 4 ? 'text-green-500' : 'text-gray-500'
                    }`}>
                      {subtask.priority}/10
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <View className="flex-row justify-around mt-6">
              <TouchableOpacity
                onPress={onConfirm}
                className="flex-1 bg-teal-600 rounded-2xl py-3 mr-2 items-center justify-center"
              >
                <Text className="text-white font-semibold">Add All to Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onCancel}
                className="flex-1 bg-stone-800 rounded-2xl py-3 ml-2 items-center justify-center"
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

export default TaskPlanConfirmationModal;