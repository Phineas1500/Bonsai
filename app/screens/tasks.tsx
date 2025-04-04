import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import React, { useCallback, useState, useMemo } from 'react';
import { useUser } from '@contexts/UserContext';
import TaskItem from '@components/TaskItem';
import { useTasks, TaskItemData } from '@contexts/TasksContext';
import GradientText from '../components/GradientText';
import TaskModal from '@components/TaskModal';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Define sort options
type SortOption = 'priority' | 'date' | 'title';

export default function Tasks() {
  const { userInfo } = useUser();
  const { tasks, isLoading, error, refreshTasks, addTask, updateTask, deleteTask, isCalendarLinked } = useTasks();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'events' | 'tasks'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItemData | undefined>(undefined);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTasks();
    setRefreshing(false);
  }, [refreshTasks]);

  // First filter, then sort the tasks
  const processedTasks = useMemo(() => {
    // Filter tasks based on selected filter
    const filtered = tasks.filter(task => {
      if (filter === 'all') return true;
      if (filter === 'events') return !task.isTask;
      if (filter === 'tasks') return task.isTask;
      return true;
    });

    // Sort tasks based on selected sort option
    return [...filtered].sort((a, b) => {
      if (sortBy === 'priority') {
        return b.priority - a.priority; // Higher priority first
      } else if (sortBy === 'date') {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime(); // Earlier dates first
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title); // Alphabetical
      }
      return 0;
    });
  }, [tasks, filter, sortBy]);

  // Toggle sort menu visibility
  const toggleSortMenu = () => {
    setSortMenuVisible(!sortMenuVisible);
  };

  // Handle sort option selection
  const handleSortSelection = (option: SortOption) => {
    setSortBy(option);
    setSortMenuVisible(false);
  };

  // Handle edit task
  const handleEditTask = (task: TaskItemData) => {
    setEditingTask(task);
    setModalVisible(true);
  };

  // Handle delete task
  const handleDeleteTask = async (taskId: string) => {
    try {
      const success = await deleteTask(taskId);
      if (!success) {
        Alert.alert("Error", "Failed to delete item");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      Alert.alert("Error", "An error occurred while deleting the item");
    }
  };

  // Handle save task (both add and edit)
  const handleSaveTask = async (task: TaskItemData): Promise<boolean> => {
    try {
      if (editingTask) {
        // Update existing task
        return await updateTask(task);
      } else {
        // Add new task
        return await addTask(task);
      }
    } catch (error) {
      console.error("Error saving task:", error);
      return false;
    }
  };

  // Open modal to add a new task
  const handleAddTask = () => {
    setEditingTask(undefined);
    setModalVisible(true);
  };

  // Close modal and reset editing state
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingTask(undefined);
  };

  const taskComponents = () => {
    return processedTasks.map((taskItem: TaskItemData) => (
      <React.Fragment key={taskItem.id}>
        <TaskItem
          itemData={taskItem}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
        />
        <View className="h-2" />
      </React.Fragment>
    ));
  };

  // Get label for sort button
  const getSortButtonLabel = () => {
    switch (sortBy) {
      case 'priority':
        return 'Priority';
      case 'date':
        return 'Date';
      case 'title':
        return 'Title';
      default:
        return 'Sort';
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 flex-col items-start bg-stone-950 px-6 pt-6">
        <View className="w-full items-center justify-center">
          <GradientText classStyle="text-center text-4xl font-black" text="All Items" size={[200, 50]} />

          {/* Filters and Sort Options */}
          <View className="w-full flex-row justify-between">
            {/* SORT OPTIONS */}
            <View className="relative">
              <TouchableOpacity
                onPress={toggleSortMenu}
                className="bg-neutral-800 p-2 rounded-lg flex-row items-center">
                <MaterialIcons name="sort" size={16} color="white" />
              </TouchableOpacity>

              {/* Sort Options Menu */}
              {sortMenuVisible && (
                <View className="absolute top-10 left-0 bg-stone-800 rounded-lg p-1 z-10 shadow-lg min-w-[120px]">
                  <TouchableOpacity
                    onPress={() => handleSortSelection('priority')}
                    className={`p-2 rounded ${sortBy === 'priority' ? 'bg-teal-800' : ''}`}>
                    <Text className="text-white">Priority</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSortSelection('date')}
                    className={`p-2 rounded ${sortBy === 'date' ? 'bg-teal-800' : ''}`}>
                    <Text className="text-white">Date</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSortSelection('title')}
                    className={`p-2 rounded ${sortBy === 'title' ? 'bg-teal-800' : ''}`}>
                    <Text className="text-white">Title</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            { /* FILTER OPTIONS - tHE MIDDLE OPTIONS */}
            <View className="flex-row">
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

            {/* ADD TASKS BUTTON */}
            <TouchableOpacity
              onPress={handleAddTask}
              className="bg-teal-700 w-8 h-8 rounded-lg justify-center items-center shadow-lg"
              disabled={!isCalendarLinked}
            >
              <AntDesign name="plus" size={12} color="white" />
            </TouchableOpacity>
          </View>

          {!isCalendarLinked && (
            <Text className="text-yellow-500 text-xs mt-2 text-center">
              Connect Google Calendar in Settings to add tasks
            </Text>
          )}
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
            {processedTasks.length > 0 ? taskComponents() : (
              <Text className="text-gray-400 text-center mt-8">
                {isCalendarLinked ? "No items found" : "Connect Google Calendar to view tasks"}
              </Text>
            )}
            <View className="h-20" />
          </ScrollView>
        )}

        {/* Task Modal for Add/Edit */}
        <TaskModal
          visible={modalVisible}
          onClose={handleCloseModal}
          onSave={handleSaveTask}
          task={editingTask}
          isGoogleCalendarLinked={isCalendarLinked}
          onSuccess={refreshTasks}
        />
      </View>
    </GestureHandlerRootView>
  );
}