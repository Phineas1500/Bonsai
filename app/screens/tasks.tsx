import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useUser } from '@contexts/UserContext';
import TaskItem from '@components/TaskItem';
import { useTasks, TaskItemData } from '@contexts/TasksContext';
import GradientText from '../components/GradientText';

export default function Tasks() {
  const { userInfo } = useUser();
  const { tasks, isLoading, error, refreshTasks } = useTasks();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTasks();
    setRefreshing(false);
  }, [refreshTasks]);

  const taskComponents = () => {
    return tasks.map((taskItem: TaskItemData) => (
      <>
        <TaskItem key={taskItem.id} itemData={taskItem} />
        <View key={`${taskItem.id}-divider`} className="h-2" />
      </>
    ));
  };

  return (
    <>
      <View className="flex-1 flex-col items-start bg-stone-950 px-6 pt-6">
        <View className="w-full items-center justify-center">
          <GradientText classStyle="text-center text-4xl font-black" text="All Events" size={[200, 50]} />
        </View>
        {error && (
          <View className="w-full p-4 bg-red-900 rounded-md my-2">
            <Text className="text-white">{error}</Text>
          </View>
        )}
        {isLoading && !refreshing ? (
          <View className="flex-1 justify-center items-center w-full">
            <ActivityIndicator size="large" color="#14b8a6" />
            <Text className="text-teal-500 mt-2">Loading tasks...</Text>
          </View>
        ) : (
          <ScrollView
            className="w-full pt-6"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#14b8a6" />
            }
          >
            {tasks.length > 0 ? taskComponents() : (
              <Text className="text-gray-400 text-center mt-8">No tasks found</Text>
            )}
            <View className="h-20" />
          </ScrollView>
        )}
      </View>
    </>
  );
}