import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { router } from 'expo-router';
import { TaskItemData, useTasks } from '@contexts/TasksContext';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

// i have no idea how to make this better without some gpt thing
const getTaskIcon = (task: TaskItemData) => {
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


const TasksSnapshot = () => {
  const { tasks, isLoading } = useTasks();

  if (isLoading && tasks.length === 0) {
    return (
      <View className="py-4">
        <Text className="text-teal-500 font-medium mb-2">Your Tasks</Text>
        <ActivityIndicator size="small" color="#14b8a6" />
      </View>
    );
  }

  // Show up to 3 tasks in the snapshot
  const upcomingTasks = tasks.slice(0, 4);

  return (
    <View className="py-4">
      {upcomingTasks.length > 0 ? (
        <View className='w-full'>
          {upcomingTasks.map(task => (
            <View className='flex flex-row' key={task.id}>
              <View className='w-1/5 flex flex-col items-end justify-start mr-2'>
                <Text className="text-gray-400 text-xs">
                  {format(new Date(task.startTime), 'MMM d')}
                </Text>
                <Text className="text-gray-400 text-xs ml-2">
                  {format(new Date(task.startTime), 'h:mm a')}
                </Text>
              </View>
              <View className="flex flex-row w-3/4 bg-stone-800 rounded-lg px-3 py-2 mb-2">
                <View className="rounded-full bg-opacity-20 justify-center">
                  {getTaskIcon(task)}
                </View>
                <View className='ml-2 flex-1'>
                  <Text className="text-white font-medium" numberOfLines={2} ellipsizeMode="tail">{task.title}</Text>
                  <Text className="text-gray-400 text-sm" numberOfLines={3} ellipsizeMode="tail">{task.description}</Text>
                </View>
              </View>
            </View>
          ))}
          {tasks.length > 2 && (
            <TouchableOpacity onPress={() => router.push('/screens/tasks')}>
              <Text className="text-gray-400 text-sm mt-1 text-center">
                + {tasks.length - 2} more events
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Text className="text-gray-400">No upcoming events!</Text>
      )}
    </View>
  );
};

export default TasksSnapshot;
