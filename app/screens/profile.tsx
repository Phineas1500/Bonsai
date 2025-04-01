import { View, Text, Image, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import GradientText from "@components/GradientText";
import { auth } from "@/firebaseConfig";
import { useEffect, useState } from "react";
import {
  getUserByEmail,
  getUserByUsername,
  getFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend
} from "@components/utils/userManagement";
import { format } from 'date-fns';
import { useLocalSearchParams } from "expo-router";
import { useUser } from "@contexts/UserContext";
import { Feather } from '@expo/vector-icons';

// interface of all user info stored in firestore
interface UserInfo {
  email: string;
  username: string;
  signinType: string;
  createdAt: string;
  friends?: string[];
  incomingFriendRequests?: string[];
  outgoingFriendRequests?: string[];
}

type FriendshipStatus = 'none' | 'friends' | 'incoming' | 'outgoing' | 'error';

export default function Profile() {
  const { username: usernameParam } = useLocalSearchParams<{ username: string }>();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCurrentUser, setIsCurrentUser] = useState(true);
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>('none');
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  const loadUserInfo = async () => {
    try {
      setLoading(true);
      // If a username parameter was passed, load that specific user
      if (usernameParam) {
        const userDoc = await getUserByUsername(usernameParam);

        if (userDoc) {
          const data = userDoc.data();
          const userData: UserInfo = {
            email: data.email,
            username: data.username,
            signinType: data.signinType,
            createdAt: data.createdAt,
            friends: data.friends || [],
            incomingFriendRequests: data.incomingFriendRequests || [],
            outgoingFriendRequests: data.outgoingFriendRequests || []
          };
          setUserInfo(userData);

          // Check if this is the current user
          const currentUser = auth.currentUser;
          const isSelfProfile = currentUser?.email?.toLowerCase() === data.email.toLowerCase();
          setIsCurrentUser(isSelfProfile);

          // If not current user, check friendship status
          if (!isSelfProfile && currentUser?.email) {
            const friendshipResult = await getFriendshipStatus(data.email);
            setFriendStatus(friendshipResult.status as FriendshipStatus);
          }
        } else {
          throw new Error('User not found');
        }
      }
      // Otherwise load the current user from auth
      else {
        const user = auth.currentUser;

        if (user && user.email) {
          // load user information from firestore
          const userDoc = await getUserByEmail(user.email);

          if (userDoc) {
            const data = userDoc.data();
            const userData: UserInfo = {
              email: data.email,
              username: data.username,
              signinType: data.signinType,
              createdAt: data.createdAt,
              friends: data.friends || [],
              incomingFriendRequests: data.incomingFriendRequests || [],
              outgoingFriendRequests: data.outgoingFriendRequests || []
            };
            setUserInfo(userData);
            setIsCurrentUser(true);
          } else {
            throw new Error('Error loading user info: null userDoc');
          }
        } else {
          throw new Error('Error loading user info: null user or email');
        }
      }
    } catch (err: any) {
      // error in loading user info
      console.error(err.message);
    } finally {
      // page finished loading
      setLoading(false);
    }
  };

  // Handle friend request button press
  const handleFriendAction = async () => {
    if (!userInfo?.email) return;

    setFriendActionLoading(true);
    try {
      switch (friendStatus) {
        case 'none':
          // Send friend request
          const sendResult = await sendFriendRequest(userInfo.email);
          if (sendResult.success) {
            setFriendStatus('outgoing');
            Alert.alert("Success", "Friend request sent!");
          } else {
            Alert.alert("Error", sendResult.error || "Failed to send friend request");
          }
          break;

        case 'friends':
          // Remove friend
          const confirmRemove = await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Remove Friend",
              `Are you sure you want to remove ${userInfo.username} from your friends?`,
              [
                { text: "Cancel", onPress: () => resolve(false) },
                { text: "Remove", onPress: () => resolve(true), style: "destructive" }
              ]
            );
          });

          if (confirmRemove) {
            const removeResult = await removeFriend(userInfo.email);
            if (removeResult.success) {
              setFriendStatus('none');
              Alert.alert("Success", "Friend removed");
            } else {
              Alert.alert("Error", removeResult.error || "Failed to remove friend");
            }
          }
          break;

        case 'outgoing':
          // Cancel request
          const cancelResult = await cancelFriendRequest(userInfo.email);
          if (cancelResult.success) {
            setFriendStatus('none');
            Alert.alert("Success", "Friend request canceled");
          } else {
            Alert.alert("Error", cancelResult.error || "Failed to cancel friend request");
          }
          break;

        case 'incoming':
          // Show accept/reject options
          Alert.alert(
            "Friend Request",
            `${userInfo.username} sent you a friend request`,
            [
              {
                text: "Reject", onPress: async () => {
                  const rejectResult = await rejectFriendRequest(userInfo.email);
                  if (rejectResult.success) {
                    setFriendStatus('none');
                    Alert.alert("Success", "Friend request rejected");
                  } else {
                    Alert.alert("Error", rejectResult.error || "Failed to reject friend request");
                  }
                }, style: "destructive"
              },
              {
                text: "Accept", onPress: async () => {
                  const acceptResult = await acceptFriendRequest(userInfo.email);
                  if (acceptResult.success) {
                    setFriendStatus('friends');
                    Alert.alert("Success", "Friend request accepted!");
                  } else {
                    Alert.alert("Error", acceptResult.error || "Failed to accept friend request");
                  }
                }
              }
            ]
          );
          break;
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "An error occurred");
    } finally {
      setFriendActionLoading(false);
    }
  };

  // load user info on page load and if username param changes
  useEffect(() => {
    loadUserInfo();
  }, [usernameParam]);

  // Get button text based on friend status
  const getFriendButtonText = () => {
    switch (friendStatus) {
      case 'none': return "Add Friend";
      case 'friends': return "Friends";
      case 'outgoing': return "Request Sent";
      case 'incoming': return "Respond to Request";
      default: return "Loading...";
    }
  };

  // Get button icon based on friend status
  const getFriendButtonIcon = () => {
    switch (friendStatus) {
      case 'none': return "user-plus";
      case 'friends': return "users";
      case 'outgoing': return "clock";
      case 'incoming': return "user-check";
      default: return "user";
    }
  };

  return (
    <View className="flex-1 bg-stone-950">
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#14b8a6" />
        </View>
      ) : (
        <View className="flex-1">

          {/* Profile Content */}
          <View className="px-6">
            {/* Profile Picture */}
            <View className="items-center">
              <Image
                source={require('@assets/images/bonsai-logo.png')}
                className="w-32 h-32 rounded-3xl border-4 border-stone-950 bg-gray-800"
                resizeMode="contain"
              />
            </View>

            {/* Username */}
            <View className="items-center">
              <GradientText
                text={userInfo ? userInfo.username : "First Last"}
                classStyle="text-3xl font-bold"
                size={[800, 40]}
              />

              {/* Email */}
              {isCurrentUser && (
                <Text className="text-gray-400 text-base mt-1">
                  {userInfo ? userInfo.email : "FirstLast@Email"}
                </Text>
              )}

              {/* User Since */}
              <Text className="text-gray-500 text-xs">
                User since {format(new Date(userInfo ? userInfo.createdAt : '0000'), 'MMMM yyyy')}
              </Text>
            </View>

            {/* Friend Action Button */}
            {!isCurrentUser && userInfo && (
              <View className="items-center mt-3">
                <TouchableOpacity
                  className={`flex-row items-center justify-center px-8 py-2 rounded-full ${friendStatus === 'friends' ? 'bg-teal-500' :
                      friendStatus === 'outgoing' ? 'bg-orange-800' :
                        friendStatus === 'incoming' ? 'bg-blue-800' :
                          'bg-teal-800'
                    }`}
                  onPress={handleFriendAction}
                  disabled={friendActionLoading}
                >
                  {friendActionLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Feather name={getFriendButtonIcon() as any} size={20} color="white" style={{ marginRight: 8 }} />
                      <Text className="text-white font-medium text-base">{getFriendButtonText()}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

          </View>
        </View>
      )}
    </View>
  );
}
