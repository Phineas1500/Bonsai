import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';
import { useTasks } from '@contexts/TasksContext';

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
  const upcomingTasks = tasks.slice(0, 2);

  return (
    <View className="py-4">
      <Text className="text-teal-500 font-medium mb-2">Your Tasks</Text>
      {upcomingTasks.length > 0 ? (
        <View>
          {upcomingTasks.map(task => (
            <View key={task.id} className="bg-stone-800 rounded-lg px-3 py-2 mb-2">
              <Text className="text-white font-medium">{task.title}</Text>
              <Text className="text-gray-400 text-xs">
                {format(new Date(task.startTime), 'MMM d, h:mm a')}
              </Text>
            </View>
          ))}
          {tasks.length > 3 && (
            <Text className="text-gray-400 text-sm mt-1">
              + {tasks.length - 3} more tasks
            </Text>
          )}
        </View>
      ) : (
        <Text className="text-gray-400">No upcoming tasks</Text>
      )}
    </View>
  );
};

export default TasksSnapshot;
