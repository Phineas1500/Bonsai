import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { format, parseISO } from 'date-fns';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

interface EventDetails {
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
}

// Match the interface defined in chat.tsx
interface EventConfirmationModalProps {
  visible: boolean;
  eventDetails: EventDetails;
  onConfirm: () => void;
  onCancel: () => void;
  eventCount: number;
  currentEventIndex: number;
}

const EventConfirmationModal = ({
  visible,
  eventDetails,
  onConfirm,
  onCancel,
  eventCount,
  currentEventIndex
}: EventConfirmationModalProps) => {
  const { title, description, location, startTime, endTime } = eventDetails;
  
  // Format the dates for display
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMMM d, yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <BlurView intensity={20} className="absolute w-full h-full">
        <View className="flex-1 justify-center items-center">
          <View className="bg-stone-900 w-11/12 p-5 rounded-lg">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-2xl font-bold">Confirm Calendar Event</Text>
              <TouchableOpacity onPress={onCancel} className="p-2">
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            {eventCount > 1 && (
              <Text className="text-teal-500 mb-3">
                Event {currentEventIndex + 1} of {eventCount}
              </Text>
            )}
            
            <View className="mb-4">
              <Text className="text-teal-500 font-semibold mb-1">Title:</Text>
              <Text className="text-white text-lg">{title}</Text>
            </View>
            
            {description ? (
              <View className="mb-4">
                <Text className="text-teal-500 font-semibold mb-1">Description:</Text>
                <Text className="text-white">{description}</Text>
              </View>
            ) : null}
            
            {location ? (
              <View className="mb-4">
                <Text className="text-teal-500 font-semibold mb-1">Location:</Text>
                <Text className="text-white">{location}</Text>
              </View>
            ) : null}
            
            <View className="mb-4">
              <Text className="text-teal-500 font-semibold mb-1">Time:</Text>
              <Text className="text-white">
                {formatDate(startTime)}
              </Text>
              <Text className="text-white">
                to {formatDate(endTime)}
              </Text>
            </View>
            
            <View className="flex-row justify-around mt-6">
              <TouchableOpacity
                onPress={onConfirm}
                className="flex-1 bg-teal-600 rounded-2xl py-3 mr-2 items-center justify-center"
              >
                <Text className="text-white font-semibold">Add to Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onCancel}
                className="flex-1 bg-stone-800 rounded-2xl py-3 ml-2 items-center justify-center"
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

export default EventConfirmationModal;