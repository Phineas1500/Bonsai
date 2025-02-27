import { View, Image, Text, TouchableOpacity, Animated, Platform, StatusBar, Dimensions } from "react-native";
import { useState, useRef } from 'react';
import { router } from 'expo-router';
import GradientText from "./GradientText";
import { BlurView } from 'expo-blur';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

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
            <View style={{ paddingTop: statusBarHeight }} className="flex-row items-center justify-between px-5 w-full z-50">
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
                    <Text className="text-teal-500 text-2xl">☰</Text>
                </TouchableOpacity>
            </View>

            {/* blur overlay */}
            {isOpen && (
                <TouchableOpacity
                    className="absolute left-0 right-0 bottom-0 top-0 z-40"
                    style={{ height: Dimensions.get('window').height }}
                    onPress={toggleDropdown}
                >
                    <BlurView
                        intensity={20}
                        className="absolute left-0 right-0 bottom-0 top-0"
                    />
                </TouchableOpacity>
            )}

            {/* dropdown menu */}
            <Animated.View
                className="overflow-hidden self-end absolute z-50"
                style={{
                    height: dropdownHeight,
                    top: statusBarHeight + 36 // Using statusBarHeight variable
                }}
            >
                <View className="p-4">
                    <TouchableOpacity
                        className="flex-row items-center mb-2"
                        onPress={() => router.push('/screens/chat')}
                    >
                        <Feather name="home" size={20} color={"#14b8a6"} style={{marginRight: 8}} />
                        <Text className="text-white text-lg">Home</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center mb-2"
                        onPress={() => router.push('/screens/profile')}
                    >
                        <Feather name="user" size={20} color={"#14b8a6"} style={{marginRight: 8}} />
                        <Text className="text-white text-lg">Profile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center mb-2"
                        onPress={() => router.push('/screens/tasks')}
                    >
                        <MaterialCommunityIcons name="target" size={20} color={"#14b8a6"} style={{marginRight: 8}} />
                        <Text className="text-white text-lg">Goals</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center"
                        onPress={() => router.push('/screens/settings')}
                    >
                        <Feather name="settings" size={20} color={"#14b8a6"} style={{marginRight: 8}} />
                        <Text className="text-white text-lg">Settings</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    )
}