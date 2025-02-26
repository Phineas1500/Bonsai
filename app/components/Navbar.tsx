import { View, Image, Text, TouchableOpacity, Animated } from "react-native";
import { useState, useRef } from 'react';
import { router } from 'expo-router';

export default function Navbar() {

    const [isOpen, setIsOpen] = useState(false);
    const dropdownHeight = useRef(new Animated.Value(0)).current; 

    const toggleDropdown = () => {
        Animated.timing(dropdownHeight, {
            toValue: isOpen ? 0 : 150, 
            duration: 300,
            useNativeDriver: false, 
        }).start();
        setIsOpen(!isOpen);
    };

    return (
        <View className="flex-col items-center">
            {/* navbar */}
            <View className="h-16 bg-gray-900 flex-row items-center justify-between px-5 w-full">
                <Image
                    source={require('@assets/images/bonsai-logo.png')}
                    className="w-10 h-10"
                    resizeMode="contain"
                />
                <TouchableOpacity onPress={toggleDropdown}>
                    <Text className="text-white text-lg">☰</Text>
                </TouchableOpacity>
            </View>

            {/* dropdown menu */}
            <Animated.View
                    style={{ height: dropdownHeight }}
                    className="bg-gray-800 overflow-hidden self-end absolute z-50 top-16"
                >
                <View className="p-4">
                    <Text 
                        className="text-white text-lg mb-2"
                        onPress={() => router.push('/screens/chat')}
                    >
                        Home
                    </Text>
                    <Text 
                        className="text-white text-lg mb-2"
                        onPress={() => router.push('/screens/profile')}
                    >
                        Profile
                    </Text>
                    <Text 
                        className="text-white text-lg mb-2"
                        onPress={() => router.push('/screens/tasks')}
                    >
                        Tasks
                    </Text>
                    <Text className="text-white text-lg"
                          onPress={() => router.push('/screens/settings')}
                    >
                        Settings
                    </Text>
                </View>
            </Animated.View>
        </View>
        

        
    )
}