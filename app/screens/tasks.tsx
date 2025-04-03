import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useUser } from '@contexts/UserContext';
import TaskItem from '@components/TaskItem';
import { useTasks, TaskItemData } from '@contexts/TasksContext';
import GradientText from '../components/GradientText';

export default function Tasks() {
  const { userInfo } = useUser();
  const { tasks, isLoading, error, refreshTasks } = useTasks();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'events' | 'tasks'>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTasks();
    setRefreshing(false);
  }, [refreshTasks]);

  // Filter tasks based on selected filter
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'events') return !task.isTask;
    if (filter === 'tasks') return task.isTask;
    return true;
  });

  const taskComponents = () => {
    // Tasks are already sorted by priority in the TasksContext
    return filteredTasks.map((taskItem: TaskItemData) => (
      <React.Fragment key={taskItem.id}>
        <TaskItem itemData={taskItem} />
        <View className="h-2" />
      </React.Fragment>
    ));
  };

  return (
    <>
      <View className="flex-1 flex-col items-start bg-stone-950 px-6 pt-6">
        <View className="w-full items-center justify-center">
          <GradientText classStyle="text-center text-4xl font-black" text="All Items" size={[200, 50]} />
          
          <View className="w-full flex-row justify-center mt-4">
            <TouchableOpacity 
              onPress={() => setFilter('all')}
              className={`px-4 py-2 rounded-l-lg ${filter === 'all' ? 'bg-teal-700' : 'bg-stone-800'}`}>
              <Text className="text-white">All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setFilter('events')}
              className={`px-4 py-2 ${filter === 'events' ? 'bg-teal-700' : 'bg-stone-800'}`}>
              <Text className="text-white">Events</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setFilter('tasks')}
              className={`px-4 py-2 rounded-r-lg ${filter === 'tasks' ? 'bg-teal-700' : 'bg-stone-800'}`}>
              <Text className="text-white">Tasks</Text>
            </TouchableOpacity>
          </View>
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
            {filteredTasks.length > 0 ? taskComponents() : (
              <Text className="text-gray-400 text-center mt-8">No items found</Text>
            )}
            <View className="h-20" />
          </ScrollView>
        )}
      </View>
    </>
  );
}