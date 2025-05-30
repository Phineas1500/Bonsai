import React from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { TaskItemData } from '@contexts/TasksContext';
import { MaterialIcons, FontAwesome5, Ionicons, Feather } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

// Function to determine the appropriate icon for a task
export const getTaskIcon = (task: TaskItemData) => {
  if (task.isTask) {
    return <MaterialIcons name="check-circle-outline" size={20} color="#14B8A6" />;
  }

  const title = task.title.toLowerCase();
  if (title.includes('study') || title.includes('class') || title.includes('homework')) {
    return <FontAwesome5 name="book" size={20} color="#14B8A6" />;
  } else if (title.includes('meeting') || title.includes('interview')) {
    return <MaterialIcons name="meeting-room" size={20} color="#14B8A6" />;
  } else if (title.includes('gym') || title.includes('workout') || title.includes('run')) {
    return <FontAwesome5 name="running" size={20} color="#14B8A6" />;
  }

  return <MaterialIcons name="event-note" size={20} color="#14B8A6" />;
};

// Helper function to get priority color
const getPriorityColor = (priority: number) => {
  if (priority >= 8) return "#EF4444"; // Red for high priority
  if (priority >= 6) return "#F59E0B"; // Amber for medium-high priority
  if (priority >= 4) return "#10B981"; // Green for medium priority
  return "#6B7280"; // Gray for low priority
};

// Helper function to get priority indicator
const getPriorityIndicator = (priority: number) => {
  const color = getPriorityColor(priority);

  if (priority >= 8) {
    return (
      <View className="absolute -top-1 -right-1 z-10">
        <Ionicons name="alert-circle" size={18} color={color} />
      </View>
    );
  }
  return null;
};

type TaskItemProps = {
  itemData: TaskItemData;
  onEdit: (task: TaskItemData) => void;
  onDelete: (taskId: string) => void;
};

const TaskItem = ({ itemData, onEdit, onDelete }: TaskItemProps) => {
  const priorityColor = getPriorityColor(itemData.priority);
  const borderStyle = { borderLeftWidth: 4, borderLeftColor: priorityColor };

  // Handler for delete action
  const handleDelete = () => {
    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete "${itemData.title}"? This will remove it from your Google Calendar.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: () => onDelete(itemData.id),
          style: "destructive"
        }
      ]
    );
  };

  // Render right actions (edit & delete buttons)
  const renderRightActions = () => {
    return (
      <View className="flex-row mb-2 mr-3 mt-0.5">
        <TouchableOpacity
          className="bg-amber-600 justify-center items-center w-16"
          onPress={() => onEdit(itemData)}
        >
          <Feather name="edit" size={22} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-red-600 justify-center items-center w-16 rounded-r-lg"
          onPress={handleDelete}
        >
          <Feather name="trash" size={22} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false} friction={1} leftThreshold={40}>
      <View className='flex flex-row'>
        <View className='w-1/5 flex flex-col items-end justify-start mr-2'>
          <Text className="text-gray-400 text-xs">
            {itemData.isTask ? "Task" : format(new Date(itemData.startTime), 'MMM d')}
          </Text>
          <Text className="text-gray-400 text-xs ml-2">
            {itemData.isTask && itemData.endTime ?
              `${format(new Date(itemData.endTime), 'MMM d')}` :
              format(new Date(itemData.startTime), 'h:mm a')}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Text style={{color: priorityColor}} className="text-xs font-medium">
              P{itemData.priority}
            </Text>
          </View>
        </View>
        <View
          className="flex flex-row w-3/4 bg-stone-800 rounded-lg px-3 mt-0.5 py-2 mb-2 relative"
          style={borderStyle}
        >
          {getPriorityIndicator(itemData.priority)}
          <View className="rounded-full bg-opacity-20 justify-center">
            {getTaskIcon(itemData)}
          </View>
          <View className='ml-2 flex-1'>
            <Text
              className="font-medium"
              style={{color: itemData.priority >= 7 ? "#ffffff" : "#e5e5e5"}}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {itemData.title}
            </Text>
            <Text className="text-gray-400 text-sm" numberOfLines={3} ellipsizeMode="tail">
              {itemData.description}
            </Text>
            {itemData.location && (
              <Text className="text-gray-500 text-xs mt-1">
                📍 {itemData.location}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Swipeable>
  );
};

export default TaskItem;
