import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { format, parseISO } from 'date-fns';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

// Define the structure of a single task within the plan
interface TaskPlanItem {
  title: string;
  description?: string; // Make description optional
  startTime?: string; // Make startTime optional
  endTime?: string; // Make endTime optional
  priority?: number; // Make priority optional
  assignedTo?: string;
}

interface TaskPlanConfirmationModalProps {
  visible: boolean;
  // Change taskPlan prop to be an array of TaskPlanItem
  taskPlan: TaskPlanItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

const TaskPlanConfirmationModal = ({
  visible,
  taskPlan, // This is now TaskPlanItem[]
  onConfirm,
  onCancel
}: TaskPlanConfirmationModalProps) => {
  // Format the dates for display
  const formatDate = (dateString: string | undefined) => { // Allow undefined input
    if (!dateString) return 'N/A'; // Handle cases where date might be missing
    try {
      return format(parseISO(dateString), 'MMM d, h:mm a'); // Simplified format
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return dateString; // Return original string if formatting fails
    }
  };

  // Check if taskPlan is actually an array before trying to map
  if (!Array.isArray(taskPlan)) {
     console.error("TaskPlanConfirmationModal received non-array taskPlan prop:", taskPlan);
     // Optionally return null or an error message view if the prop is invalid
     return null;
  }

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
              {/* Simplified Title */}
              <Text className="text-white text-2xl font-bold">Confirm Task Plan</Text>
              <TouchableOpacity onPress={onCancel} className="p-2">
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Remove Overall Title and Description sections */}
            {/* <View className="mb-4"> ... </View> */}
            {/* {taskPlan.description ? ( ... ) : null} */}

            {/* Change "Subtasks" label */}
            <Text className="text-teal-500 font-semibold mb-2">Tasks in Plan:</Text>
            <ScrollView className="max-h-[400px] mb-4"> {/* Increased max height slightly */}
              {/* Map directly over the taskPlan array */}
              {taskPlan.map((task, index) => (
                <View key={index} className="bg-stone-800 p-3 rounded-lg mb-2">
                  {/* Use task properties directly */}
                  <Text className="text-white font-medium">{task.title}</Text>
                  {task.description ? (
                    <Text className="text-gray-300 text-sm mb-1">{task.description}</Text>
                  ) : null}
                  {/* Use updated formatDate and check existence */}
                  {task.startTime && task.endTime ? (
                    <Text className="text-gray-400 text-xs">
                      {formatDate(task.startTime)} - {formatDate(task.endTime)}
                    </Text>
                  ) : task.startTime ? (
                    <Text className="text-gray-400 text-xs">Starts: {formatDate(task.startTime)}</Text>
                  ) : task.endTime ? (
                    <Text className="text-gray-400 text-xs">Due: {formatDate(task.endTime)}</Text>
                  ) : null}
                  {task.assignedTo && (
                    <Text className="text-teal-400 text-xs mt-1">Assigned to: {task.assignedTo}</Text>
                  )}
                  {task.priority !== undefined && (
                    <View className="flex-row items-center mt-1">
                      <Text className="text-gray-400 text-xs mr-1">Priority:</Text>
                      <Text className={`text-xs ${
                        task.priority >= 8 ? 'text-red-500' :
                        task.priority >= 6 ? 'text-amber-500' :
                        task.priority >= 4 ? 'text-green-500' : 'text-gray-500'
                      }`}>
                        {task.priority}/10
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <View className="flex-row justify-around mt-6">
              <TouchableOpacity
                onPress={onConfirm}
                className="flex-1 bg-teal-600 rounded-2xl py-3 mr-2 items-center justify-center"
              >
                {/* Updated Button Text */}
                <Text className="text-white font-semibold">Confirm Tasks</Text>
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