import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import TextInput from './TextInput';
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
  onSuccess?: () => void; // New prop to handle post-save actions like refreshing
}

const TaskModal = ({ visible, onClose, onSave, task, isGoogleCalendarLinked, onSuccess }: TaskModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [type, setType] = useState<'event' | 'task'>('event');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 60 * 60 * 1000)); // default is 1 hour later
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

    // For tasks, we don't need to check start vs end time
    // For events, ensure end time is after start time
    if (type === 'event' && startDate > endDate) {
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
      // Different handling for tasks vs events
      let startTimeValue: string;
      let endTimeValue: string;

      if (type === 'task') {
        const dueDateOnly = new Date(endDate);
        
        // need to create these so times start at 0 and end at 23:59:59
        const startOfDay = new Date(
          dueDateOnly.getFullYear(),
          dueDateOnly.getMonth(),
          dueDateOnly.getDate(), 
          0, 0, 0, 0
        );
        
        const endOfDay = new Date(
          dueDateOnly.getFullYear(),
          dueDateOnly.getMonth(),
          dueDateOnly.getDate(),
          23, 59, 59, 0
        );

        startTimeValue = startOfDay.toISOString();
        endTimeValue = endOfDay.toISOString();
      } else {
        // For events, use the actual times selected
        startTimeValue = startDate.toISOString();
        endTimeValue = endDate.toISOString();
      }

      const taskData: TaskItemData = {
        id: task?.id || `temp-${Date.now()}`,
        title,
        description,
        startTime: startTimeValue,
        endTime: endTimeValue,
        location,
        priority, // Priority will be recalculated by the task context
        isTask: type === 'task'
      };

      const success = await onSave(taskData);
      if (success) {
        // Call onSuccess to refresh tasks after successful save
        if (onSuccess) {
          onSuccess();
        }
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

  // Dismiss any date/time picker that's showing
  const dismissPickers = () => {
    setShowStartDate(false);
    setShowStartTime(false);
    setShowEndDate(false);
    setShowEndTime(false);
  };

  // 
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    // Dismiss the picker in all cases
    // setShowStartDate(false);

    // If the selection was canceled or dismissed without a date
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    if (selectedDate) {
      const currentStartDate = new Date(startDate);

      // Update date parts while preserving time
      currentStartDate.setFullYear(selectedDate.getFullYear());
      currentStartDate.setMonth(selectedDate.getMonth());
      currentStartDate.setDate(selectedDate.getDate());

      setStartDate(currentStartDate);

      // If end date is now before start date, adjust it
      if (endDate < currentStartDate && type === 'event') {
        // Set end date 1 hour after start date
        setEndDate(new Date(currentStartDate.getTime() + 60 * 60 * 1000));
      }
    }
  };

  const handleStartTimeChange = (event: any, selectedDate?: Date) => {
    // Dismiss the picker in all cases
    // setShowStartTime(false);

    // If the selection was canceled or dismissed without a time
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    if (selectedDate) {
      const currentStartDate = new Date(startDate);

      // Update time parts while preserving date
      currentStartDate.setHours(selectedDate.getHours());
      currentStartDate.setMinutes(selectedDate.getMinutes());

      setStartDate(currentStartDate);

      // If end date is now before start date, adjust it
      if (endDate < currentStartDate && type === 'event') {
        // Set end date 1 hour after start date
        setEndDate(new Date(currentStartDate.getTime() + 60 * 60 * 1000));
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    // Dismiss the picker in all cases
    // setShowEndDate(false);

    // If the selection was canceled or dismissed without a date
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    if (selectedDate) {
      const currentEndDate = new Date(endDate);

      // Update date parts while preserving time (for events)
      // For tasks, set to end of day
      currentEndDate.setFullYear(selectedDate.getFullYear());
      currentEndDate.setMonth(selectedDate.getMonth());
      currentEndDate.setDate(selectedDate.getDate());

      if (type === 'task') {
        // For tasks, always set to end of day (23:59:59)
        currentEndDate.setHours(23, 59, 59, 0);
      }

      setEndDate(currentEndDate);
    }
  };

  const handleEndTimeChange = (event: any, selectedDate?: Date) => {
    // Dismiss the picker in all cases
    // setShowEndTime(false);

    // If the selection was canceled or dismissed without a time
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    if (selectedDate && type === 'event') {
      const currentEndDate = new Date(endDate);

      // Update time parts while preserving date
      currentEndDate.setHours(selectedDate.getHours());
      currentEndDate.setMinutes(selectedDate.getMinutes());

      setEndDate(currentEndDate);
    }
  };

  // Function to render date/time picker with backdrop
  const renderDateTimePicker = (
    show: boolean,
    mode: 'date' | 'time',
    value: Date,
    onChange: (event: any, date?: Date) => void
  ) => {
    if (!show) return null;

    // For iOS, render inside a modal with backdrop
    if (Platform.OS === 'ios') {
      return (
        <Modal visible={true} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={dismissPickers}>
            <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-neutral-800 rounded-t-lg p-2.5">
                <View className="flex-row justify-between p-2.5">
                  <TouchableOpacity onPress={dismissPickers}>
                    <Text className="text-teal-500 text-base">Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={value}
                  mode={mode}
                  display="spinner"
                  onChange={(e, d) => d && onChange(e, d)}
                  themeVariant="dark"
                  style={{ backgroundColor: '#262626' }} // Using inline style as DateTimePicker doesn't support className
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      );
    }

    // For Android, use the standard component
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        onChange={onChange}
        themeVariant="dark"
      />
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={50} className="flex-1 justify-center items-center bg-black/60">

        <View className="w-[90%] max-h-[85%] bg-stone-900 rounded-2xl overflow-hidden">
          <View className="flex-row justify-between items-center bg-teal-700 py-2 px-4">
            <Text className="text-white text-lg font-bold">
              {task ? 'Edit' : 'Create'} {type === 'task' ? 'Task' : 'Event'}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Feather name="x" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            {/* Type Selector */}
            <View className="mb-4">
              <Text className="text-white mb-2 text-base">Type</Text>
              <View className="flex-row bg-neutral-800 rounded-lg overflow-hidden">
                <TouchableOpacity
                  className={`flex-1 flex-row justify-center items-center p-3 ${type === 'event' ? 'bg-neutral-900' : ''}`}
                  onPress={() => !isEditing && setType('event')} // Only allow changing if not editing
                  disabled={isEditing}
                >
                  <MaterialIcons
                    name="event"
                    size={24}
                    color={type === 'event' ? '#0d9488' : (isEditing ? '#6b7280' : '#9ca3af')}
                  />
                  <Text className={`ml-2 text-base ${type === 'event' ? 'text-teal-600 font-medium' : (isEditing ? 'text-gray-500' : 'text-gray-400')}`}>Event</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 flex-row justify-center items-center p-3 ${type === 'task' ? 'bg-neutral-900' : ''}`}
                  onPress={() => !isEditing && setType('task')} // Only allow changing if not editing
                  disabled={isEditing}
                >
                  <MaterialIcons
                    name="check-circle-outline"
                    size={24}
                    color={type === 'task' ? '#0d9488' : (isEditing ? '#6b7280' : '#9ca3af')}
                  />
                  <Text className={`ml-2 text-base ${type === 'task' ? 'text-teal-600 font-medium' : (isEditing ? 'text-gray-500' : 'text-gray-400')}`}>Task</Text>
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
                value={title}
                onChangeText={setTitle}
                placeholder="Enter title"
                classStyle="bg-neutral-800 rounded-lg"
              />
            </View>

            {/* Description Field */}
            <View className="mb-4">
              <Text className="text-white mb-2 text-base">Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Enter description"
                classStyle="bg-neutral-800 rounded-lg h-24"
              />
            </View>

            {/* Location Field (for events) */}
            {type === 'event' && (
              <View className="mb-4">
                <Text className="text-white mb-2 text-base">Location</Text>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Enter location"
                  classStyle="bg-neutral-800 rounded-lg"
                />
              </View>
            )}

            {/* Start Date & Time (events only) */}
            {type === 'event' && (
              <View className="mb-4">
                <Text className="text-white mb-2 text-base">
                  Start Date & Time
                </Text>

                {/* Date Selector */}
                <TouchableOpacity
                  className="flex-row items-center bg-neutral-800 p-3 rounded-lg mb-2"
                  onPress={() => {
                    dismissPickers();
                    setShowStartDate(true);
                  }}
                >
                  <Feather name="calendar" size={20} color="#0d9488" />
                  <Text className="ml-2 text-white text-base">
                    {format(startDate, 'MMM d, yyyy')}
                  </Text>
                </TouchableOpacity>

                {/* Time Selector (for events) */}
                <TouchableOpacity
                  className="flex-row items-center bg-neutral-800 p-3 rounded-lg mb-2"
                  onPress={() => {
                    dismissPickers();
                    setShowStartTime(true);
                  }}
                >
                  <Feather name="clock" size={20} color="#0d9488" />
                  <Text className="ml-2 text-white text-base">
                    {format(startDate, 'h:mm a')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* End Date & Time / Due Date */}
            <View className="mb-4">
              <Text className="text-white mb-2 text-base">
                {type === 'task' ? 'Due Date' : 'End Date & Time'}
              </Text>

              {/* Date Selector */}
              <TouchableOpacity
                className="flex-row items-center bg-neutral-800 p-3 rounded-lg mb-2"
                onPress={() => {
                  dismissPickers();
                  setShowEndDate(true);
                }}
              >
                <Feather name="calendar" size={20} color="#0d9488" />
                <Text className="ml-2 text-white text-base">
                  {format(endDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>

              {/* Time Selector (for events only) */}
              {type === 'event' && (
                <TouchableOpacity
                  className="flex-row items-center bg-neutral-800 p-3 rounded-lg mb-2"
                  onPress={() => {
                    dismissPickers();
                    setShowEndTime(true);
                  }}
                >
                  <Feather name="clock" size={20} color="#0d9488" />
                  <Text className="ml-2 text-white text-base">
                    {format(endDate, 'h:mm a')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              className="bg-teal-700 p-4 rounded-lg items-center justify-center mt-2 mb-2 flex-row"
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Feather name="check" size={20} color="white" />
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

          {/* Date/Time Pickers (shown conditionally using the new rendering approach) */}
          {renderDateTimePicker(showStartDate, 'date', startDate, handleStartDateChange)}
          {renderDateTimePicker(showStartTime, 'time', startDate, handleStartTimeChange)}
          {renderDateTimePicker(showEndDate, 'date', endDate, handleEndDateChange)}
          {renderDateTimePicker(showEndTime, 'time', endDate, handleEndTimeChange)}
        </View>
      </BlurView>
    </Modal>
  );
};

export default TaskModal;