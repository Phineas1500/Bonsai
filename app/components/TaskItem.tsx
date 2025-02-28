import React from 'react';
import { View, Text } from 'react-native';
import { format } from 'date-fns';
import { TaskItemData } from '@contexts/TasksContext';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

// Function to determine the appropriate icon for a task
export const getTaskIcon = (task: TaskItemData) => {
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

type TaskItemProps = {
  itemData: TaskItemData;
};

const TaskItem = ({ itemData }: TaskItemProps) => {
  return (
    <View className='flex flex-row'>
      <View className='w-1/5 flex flex-col items-end justify-start mr-2'>
        <Text className="text-gray-400 text-xs">
          {format(new Date(itemData.startTime), 'MMM d')}
        </Text>
        <Text className="text-gray-400 text-xs ml-2">
          {format(new Date(itemData.startTime), 'h:mm a')}
        </Text>
      </View>
      <View className="flex flex-row w-3/4 bg-stone-800 rounded-lg px-3 py-2 mb-2">
        <View className="rounded-full bg-opacity-20 justify-center">
          {getTaskIcon(itemData)}
        </View>
        <View className='ml-2 flex-1'>
          <Text className="text-white font-medium" numberOfLines={2} ellipsizeMode="tail">
            {itemData.title}
          </Text>
          <Text className="text-gray-400 text-sm" numberOfLines={3} ellipsizeMode="tail">
            {itemData.description}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default TaskItem;
