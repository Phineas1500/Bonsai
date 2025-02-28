import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native"
import { format } from 'date-fns';
import { TaskItemData } from '@contexts/TasksContext';

export default function TaskListItem(
    { itemData }: { itemData: TaskItemData }
) {

    const [expanded, setExpanded] = useState(false);

    return (
        <View className="m-1 rounded-md overflow-hidden">
            <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                className="p-2 bg-teal-800"
            >
                <Text className="text-white text-l font-bold">
                    {itemData.title} - {format(new Date(itemData.startTime), 'EEE h:mm aaa')}
                </Text>
            </TouchableOpacity>
            {expanded ?
            <View className="bg-green-50 p-2 border border-black">
                <Text className="font-bold text-black">Time:</Text>
                <Text className="text-black mb-1">
                    {format(new Date(itemData.startTime), 'PPP, h:mm aaa')} - {format(new Date(itemData.endTime), 'PPP, h:mm aaa')}

                </Text>
                <Text className="font-bold text-black">Description:</Text>
                <Text className="text-black">
                    {itemData.description}
                </Text>
            </View>
            : null}

        </View>
    );
}