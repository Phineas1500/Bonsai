import { View, Image, Text, TouchableOpacity, Animated, Platform, StatusBar } from "react-native";
import { useState, useRef } from 'react';
import { router } from 'expo-router';
import GradientText from "./GradientText";

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

    const statusBarHeight = Platform.OS === 'ios' ? 30 : 0;

    return (
        <View className="flex-col items-center bg-transparent">
            {/* navbar */}
            <View style={{ paddingTop: statusBarHeight }} className="flex-row items-center justify-between px-5 w-full">
                <View className="flex-row items-center">
                    <Image
                        source={require('@assets/images/bonsai-logo.png')}
                        className="w-10 h-10"
                        resizeMode="contain"
                    />
                    <GradientText text="Bonsai" classStyle="ml-2 text-xl font-bold" size={[80, 25]} />
                </View>
                <TouchableOpacity
                    onPress={toggleDropdown}
                    className="p-4" // Increased touch target
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Extra hit area
                >
                    <Text className="text-white text-2xl">☰</Text>
                </TouchableOpacity>
            </View>

            {/* dropdown menu */}
            <Animated.View
                className="bg-gray-800 overflow-hidden self-end absolute z-50"
                style={{
                    height: dropdownHeight,
                    top: statusBarHeight + 64 // Using statusBarHeight variable
                }}
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