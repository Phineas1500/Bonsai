import { View, Text, Image } from "react-native";
import { useEffect } from "react";
import Navbar from "@components/Navbar";
import GradientText from "../components/GradientText";
import { getAuth } from "firebase/auth";


export default function Profile() {
  // get user's info
  const user = getAuth().currentUser
  var username, email;
  if (user != null) {
    username = user.displayName;
    email = user.email;
  }

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
            text={username ? username : "First Last"}
            classStyle="text-4xl font-black mt-8"
            size={[800, 80]}
          />
          <GradientText
            text={email ? email : "FirstLast@Email"}
            classStyle="text-xl font-black"
            size={[800, 80]}
          />
        </View>
      </View>
    </>
  );
}
