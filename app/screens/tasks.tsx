import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useUser } from '@contexts/UserContext';
import TaskListItem from '@components/TaskListItem';
import { useTasks, TaskItemData } from '@contexts/TasksContext';

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
      <TaskListItem key={taskItem.id} itemData={taskItem} />
    ));
  };

  return (
    <>
      <View className="flex-1 flex-col items-start bg-stone-950 p-6">
        <Text className="text-2xl font-light text-teal-500 text-center">
          Tasks:
        </Text>
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
            className="w-full"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#14b8a6" />
            }
          >
            {tasks.length > 0 ? taskComponents() : (
              <Text className="text-gray-400 text-center mt-8">No tasks found</Text>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}