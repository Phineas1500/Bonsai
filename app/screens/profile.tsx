import { View, Text, Image } from "react-native";
import Navbar from "@components/Navbar";
import GradientText from "../components/GradientText";


export default function Profile() {
  return (
    <>
      <Navbar />
      <View className="flex-1 bg-stone-950 p-6 pt-8 justify-between">
        <View className="w-full max-w-md items-center">
          <Image
            source={require('@assets/images/bonsai-logo.png')}
            className="w-48 h-48 rounded-2xl mb-2 bg-gray-800"
            resizeMode="contain"
          />
          <GradientText
            text="First Last"
            classStyle="text-4xl font-black mt-4"
            size={[800, 80]}
          />
        </View>
      </View>
    </>
  );
}
