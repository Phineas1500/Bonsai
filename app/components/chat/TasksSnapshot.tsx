import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTasks } from '@contexts/TasksContext';
import TaskItem from '../TaskItem';

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
  const SHOW_TASKS = 3;
  const upcomingTasks = tasks.slice(0, SHOW_TASKS);

  return (
    <View className="py-4">
      {upcomingTasks.length > 0 ? (
        <View className='w-full'>
          {upcomingTasks.map(task => (
            <TaskItem key={task.id} itemData={task} />
          ))}
          <TouchableOpacity onPress={() => router.push('/screens/tasks')}>
            {tasks.length > SHOW_TASKS + 1 ? (
              <Text className="text-gray-400 text-sm mt-1 text-center">
                + {tasks.length - SHOW_TASKS} more events
              </Text>
            ) :
              <Text className="text-gray-400 text-sm mt-1 text-center">
                View all events
              </Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <Text className="text-gray-400">No upcoming events!</Text>
      )}
    </View>
  );
};

export default TasksSnapshot;
