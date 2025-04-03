import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { TaskItemData } from '@contexts/TasksContext';
import { BlurView } from 'expo-blur';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

interface TaskModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (task: TaskItemData) => Promise<boolean>;
  task?: TaskItemData;  // If provided, we're editing an existing task
  isGoogleCalendarLinked: boolean;
}

const TaskModal = ({ visible, onClose, onSave, task, isGoogleCalendarLinked }: TaskModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [type, setType] = useState<'event' | 'task'>('event');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 60 * 60 * 1000)); // Default to 1 hour later
  const [priority, setPriority] = useState(5); // Default priority, will be calculated automatically

  const [showStartDate, setShowStartDate] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);

  // Check if this is editing mode
  const isEditing = !!task;

  // Initialize form with existing task data if editing
  useEffect(() => {
    if (task) {
      setType(task.isTask ? 'task' : 'event');
      setTitle(task.title);
      setDescription(task.description || '');
      setLocation(task.location || '');
      setStartDate(new Date(task.startTime));
      setEndDate(new Date(task.endTime));
      setPriority(task.priority);
    } else {
      // Reset form for new task
      setType('event');
      setTitle('');
      setDescription('');
      setLocation('');
      setStartDate(new Date());
      setEndDate(new Date(new Date().getTime() + 60 * 60 * 1000));
      setPriority(5);
    }
  }, [task, visible]);

  const handleSave = async () => {
    if (!title) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (startDate > endDate) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }

    // Show confirmation if connected to Google Calendar
    if (isGoogleCalendarLinked) {
      Alert.alert(
        task ? 'Update Google Calendar' : 'Add to Google Calendar',
        `This will ${task ? 'update' : 'add'} this ${type} to your Google Calendar. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              await saveTask();
            }
          }
        ]
      );
    } else {
      await saveTask();
    }
  };

  const saveTask = async () => {
    setIsLoading(true);
    try {
      const taskData: TaskItemData = {
        id: task?.id || `temp-${Date.now()}`,
        title,
        description,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        location,
        priority, // Priority will be recalculated by the task context
        isTask: type === 'task'
      };

      const success = await onSave(taskData);
      if (success) {
        onClose();
      } else {
        Alert.alert('Error', 'Failed to save task');
      }
    } catch (error) {
      console.error('Error saving task:', error);
      Alert.alert('Error', 'An error occurred while saving');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDate(Platform.OS === 'ios');
    setShowStartTime(Platform.OS === 'ios');

    if (selectedDate) {
      const currentStartDate = new Date(startDate);

      // If changing date, preserve the time
      if (showStartDate) {
        currentStartDate.setFullYear(selectedDate.getFullYear());
        currentStartDate.setMonth(selectedDate.getMonth());
        currentStartDate.setDate(selectedDate.getDate());
      }

      // If changing time, preserve the date
      if (showStartTime) {
        currentStartDate.setHours(selectedDate.getHours());
        currentStartDate.setMinutes(selectedDate.getMinutes());
      }

      setStartDate(currentStartDate);

      // If end date is now before start date, adjust it
      if (endDate < currentStartDate) {
        // Set end date 1 hour after start date
        setEndDate(new Date(currentStartDate.getTime() + 60 * 60 * 1000));
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDate(Platform.OS === 'ios');
    setShowEndTime(Platform.OS === 'ios');

    if (selectedDate) {
      const currentEndDate = new Date(endDate);

      // If changing date, preserve the time
      if (showEndDate) {
        currentEndDate.setFullYear(selectedDate.getFullYear());
        currentEndDate.setMonth(selectedDate.getMonth());
        currentEndDate.setDate(selectedDate.getDate());
      }

      // If changing time, preserve the date
      if (showEndTime) {
        currentEndDate.setHours(selectedDate.getHours());
        currentEndDate.setMinutes(selectedDate.getMinutes());
      }

      setEndDate(currentEndDate);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={50} className="flex-1 justify-center items-center bg-black/60">
        <View className="w-[90%] max-h-[85%] bg-[#1c1c1c] rounded-2xl overflow-hidden">
          <View className="flex-row justify-between items-center bg-teal-700 p-4">
            <Text className="text-white text-lg font-bold">
              {task ? 'Edit' : 'Create'} {type === 'task' ? 'Task' : 'Event'}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            {/* Type Selector */}
            <View className="mb-4">
              <Text className="text-white mb-2 text-base">Type</Text>
              <View className="flex-row bg-[#2d2d2d] rounded-lg overflow-hidden">
                <TouchableOpacity
                  className={`flex-1 flex-row justify-center items-center p-3 ${type === 'event' ? 'bg-[#212121]' : ''}`}
                  onPress={() => !isEditing && setType('event')} // Only allow changing if not editing
                  disabled={isEditing}
                >
                  <MaterialIcons
                    name="event"
                    size={24}
                    color={type === 'event' ? '#14b8a6' : (isEditing ? '#555' : '#999')}
                  />
                  <Text className={`ml-2 text-base ${type === 'event' ? 'text-teal-700 font-medium' : (isEditing ? 'text-gray-600' : 'text-gray-400')}`}>Event</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 flex-row justify-center items-center p-3 ${type === 'task' ? 'bg-[#212121]' : ''}`}
                  onPress={() => !isEditing && setType('task')} // Only allow changing if not editing
                  disabled={isEditing}
                >
                  <MaterialIcons
                    name="check-circle-outline"
                    size={24}
                    color={type === 'task' ? '#14b8a6' : (isEditing ? '#555' : '#999')}
                  />
                  <Text className={`ml-2 text-base ${type === 'task' ? 'text-teal-700 font-medium' : (isEditing ? 'text-gray-600' : 'text-gray-400')}`}>Task</Text>
                </TouchableOpacity>
              </View>
              {isEditing && (
                <Text className="text-gray-500 text-xs italic mt-1 text-center">
                  Type cannot be changed for existing items
                </Text>
              )}
            </View>

            {/* Title Field */}
            <View className="mb-4">
              <Text className="text-white mb-2 text-base">Title *</Text>
              <TextInput
                className="bg-[#2d2d2d] p-3 rounded-lg text-white text-base"
                value={title}
                onChangeText={setTitle}
                placeholder="Enter title"
                placeholderTextColor="#999"
              />
            </View>

            {/* Description Field */}
            <View className="mb-4">
              <Text className="text-white mb-2 text-base">Description</Text>
              <TextInput
                className="bg-[#2d2d2d] p-3 rounded-lg text-white text-base h-24"
                value={description}
                onChangeText={setDescription}
                placeholder="Enter description"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Location Field (for events) */}
            {type === 'event' && (
              <View className="mb-4">
                <Text className="text-white mb-2 text-base">Location</Text>
                <TextInput
                  className="bg-[#2d2d2d] p-3 rounded-lg text-white text-base"
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Enter location"
                  placeholderTextColor="#999"
                />
              </View>
            )}

            {/* Time Fields */}
            {type === 'event' && (
              <View className="mb-4">
                <Text className="text-white mb-2 text-base">
                  Start Date & Time
                </Text>

                {/* Date Selector */}
                <TouchableOpacity
                  className="flex-row items-center bg-[#2d2d2d] p-3 rounded-lg mb-2"
                  onPress={() => setShowStartDate(true)}
                >
                  <Feather name="calendar" size={20} color="#14b8a6" />
                  <Text className="ml-2 text-white text-base">
                    {format(startDate, 'MMM d, yyyy')}
                  </Text>
                </TouchableOpacity>

                {/* Time Selector (for events) */}
                {type === 'event' && (
                  <TouchableOpacity
                    className="flex-row items-center bg-[#2d2d2d] p-3 rounded-lg mb-2"
                    onPress={() => setShowStartTime(true)}
                  >
                    <Feather name="clock" size={20} color="#14b8a6" />
                    <Text className="ml-2 text-white text-base">
                      {format(startDate, 'h:mm a')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View className="mb-4">
              <Text className="text-white mb-2 text-base">
                {type === 'task' ? 'Due Date' : 'End Date & Time'}
              </Text>

              {/* Date Selector */}
              <TouchableOpacity
                className="flex-row items-center bg-[#2d2d2d] p-3 rounded-lg mb-2"
                onPress={() => setShowEndDate(true)}
              >
                <Feather name="calendar" size={20} color="#14b8a6" />
                <Text className="ml-2 text-white text-base">
                  {format(endDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>

              {/* Time Selector */}
              <TouchableOpacity
                className="flex-row items-center bg-[#2d2d2d] p-3 rounded-lg mb-2"
                onPress={() => setShowEndTime(true)}
              >
                <Feather name="clock" size={20} color="#14b8a6" />
                <Text className="ml-2 text-white text-base">
                  {format(endDate, 'h:mm a')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              className="bg-teal-700 p-4 rounded-lg items-center justify-center mt-2 mb-2 flex-row"
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={20} color="#fff" />
                  <Text className="ml-2 text-white font-bold text-base">
                    {task ? 'Update' : 'Create'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Google Calendar Integration Warning */}
            {isGoogleCalendarLinked && (
              <Text className="text-center text-yellow-500 mt-2 mb-4 text-sm">
                Note: This will {task ? 'update' : 'create'} an item in your Google Calendar
              </Text>
            )}
          </ScrollView>

          {/* Date Pickers (hidden by default) */}
          {showStartDate && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleStartDateChange}
              themeVariant="dark"
            />
          )}

          {showStartTime && type === 'event' && (
            <DateTimePicker
              value={startDate}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleStartDateChange}
              themeVariant="dark"
            />
          )}

          {showEndDate && (
            <DateTimePicker
              value={endDate}
              mode="date"
              minimumDate={type === 'event' ? startDate : undefined}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleEndDateChange}
              themeVariant="dark"
            />
          )}

          {showEndTime && (
            <DateTimePicker
              value={endDate}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleEndDateChange}
              themeVariant="dark"
            />
          )}
        </View>
      </BlurView>
    </Modal>
  );
};

export default TaskModal;