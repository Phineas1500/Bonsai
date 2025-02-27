import { View, Text, Image, TouchableOpacity } from "react-native";
import Navbar from "@components/Navbar";
import GradientText from "../components/GradientText";
import { getAuth } from "firebase/auth";
import { useEffect, useState } from "react";
import { getUserByEmail } from "@components/utils/userManagement";
import ChangeUsernameModal from "@components/ChangeUsernameModal";

// interface of all user info stored in firestore
interface UserInfo {
  email: string;
  username: string;
  signinType: string;
  createdAt: string;
}

export default function Profile() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [changeUsernamePrompt, setChangeUsernamePrompt] = useState(false);

  const loadUserInfo = async () => {
    // get current user from auth
    const user = getAuth().currentUser;

    try {
      if (user != null) {
        const email = user.email;
        if (email != null) {
          // load user information from firestore
          const userDoc = await getUserByEmail(email);
          if (userDoc != null) {
            const data = userDoc.data();
            const userData: UserInfo = {
              email: data.email,
              username: data.username,
              signinType: data.signintype,
              createdAt: data.createdAt
            };
            setUserInfo(userData);
          }
          else {
            throw new Error('Error loading user info: null userDoc');
          }
        }
        else {
          throw new Error('Error loading user info: null email');
        }
      }
      else {
        throw new Error('Error loading user info: null user');
      }
    } catch (err: any) {
      // error in loading user info
      console.error(err.message)
    } finally {
      // page finished loading
      setLoading(false);
    }
  }

  // load all user info on page load
  useEffect(() => {
    loadUserInfo();
  }, []);

  return (
    <>
      <Navbar />
      <View className="flex-1 bg-stone-950 p-6 pt-8 justify-between">
        {!loading &&
          <View className="w-full max-w-md items-center">
            <Image
              source={require('@assets/images/bonsai-logo.png')}
              className="w-48 h-48 rounded-2xl mb-2 bg-gray-800"
              resizeMode="contain"
            />
            <GradientText
              text={userInfo ? userInfo.username : "First Last"}
              classStyle="text-4xl font-black mt-6"
              size={[800, 80]}
            />
            <GradientText
              text={userInfo ? userInfo.email : "FirstLast@Email"}
              classStyle="text-xl font-black"
              size={[800, 80]}
            />
            <ChangeUsernameModal
              visible={changeUsernamePrompt}
              currentUsername={userInfo ? userInfo.username : ""}
              onRequestClose={() => {
                setChangeUsernamePrompt(false);
                loadUserInfo();
              }}
              />
          </View>
        }
        <View className="w-full flex-row justify-center items-center gap-2 mb-8">
          <TouchableOpacity
            className="mt-8"
            onPress={() => setChangeUsernamePrompt(true)}
          >
            <Text className="text-teal-500">Change Username</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
