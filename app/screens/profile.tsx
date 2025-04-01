import { View, Text, Image } from "react-native";
import GradientText from "@components/GradientText";
import { getAuth } from "firebase/auth";
import { useEffect, useState } from "react";
import { getUserByEmail } from "@components/utils/userManagement";
import { format } from 'date-fns';

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
      <View className="flex-1 bg-stone-950 p-6 pt-8 justify-between">
        {!loading &&
          <View className="flex-1 justify-between">
            <View className="w-full max-w-md items-center">
              <Image
                source={require('@assets/images/bonsai-logo.png')}
                className="w-48 h-48 rounded-2xl mb-2 bg-gray-800"
                resizeMode="contain"
              />
              <Text className="text-teal-500">User since {format(new Date(userInfo ? userInfo.createdAt : '0000'), 'MM/dd/yyyy')}</Text>
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
            </View>
          </View>
        }
      </View>
    </>
  );
}
