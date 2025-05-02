import { View, Text, Image, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from "react-native";
import GradientText from "@components/GradientText";
import { auth } from "@/firebaseConfig";
import { useEffect, useState, useMemo } from "react";
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
import AchievementItem from "../components/AchievementItem";
import { Achievement, getAchievementDetails } from "../components/utils/achievementManagement";
import { DailyActivityLog, getActivityHistory, logActivityForToday } from "../components/utils/activityLogging";
import ActivityCalendarDay, { ActivityCalendarDayType } from "../components/ActivityCalendarDay";

// interface of all user info stored in firestore
import { UserInfo } from "@contexts/UserContext";
// interface UserInfo {
//   email: string;
//   username: string;
//   signinType: string;
//   createdAt: string;
//   friends?: string[];
//   incomingFriendRequests?: string[];
//   outgoingFriendRequests?: string[];
//   streak?: number;
//   lastCheckInDate?: string;
//   achievements?: string[];
// }

type FriendshipStatus = 'none' | 'friends' | 'incoming' | 'outgoing' | 'error';

export default function Profile() {
  const { username: usernameParam } = useLocalSearchParams<{ username: string }>();
  const { userInfo: contextUserInfo } = useUser(); // THIS IS THE LOGGED IN USER
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null); // THIS IS THE DISPLAYED USER
  const [loading, setLoading] = useState(true);
  const [isCurrentUser, setIsCurrentUser] = useState(true);
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>('none');
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activityData, setActivityData] = useState<DailyActivityLog[]>([]);

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
            usesGoogle: data.usesGoogle,
            signinType: data.signinType,
            createdAt: data.createdAt,
            friends: data.friends || [],
            incomingFriendRequests: data.incomingFriendRequests || [],
            outgoingFriendRequests: data.outgoingFriendRequests || [],
            streak: data.streak || 0,
            lastCheckInDate: data.lastCheckInDate || "0",
            achievements: data.achievements || [],
            uses2FA: data.uses2FA || false,
            additionalSettings: data.additionalSettings || {}
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
      // Otherwise use the current user from context
      else if (contextUserInfo) {
        const userDoc = await getUserByUsername(contextUserInfo.username);
        if (userDoc) {
          const data = userDoc.data();
          const userData: UserInfo = {
            email: data.email,
            username: data.username,
            usesGoogle: data.usesGoogle,
            signinType: data.signinType,
            createdAt: data.createdAt,
            friends: data.friends || [],
            incomingFriendRequests: data.incomingFriendRequests || [],
            outgoingFriendRequests: data.outgoingFriendRequests || [],
            streak: data.streak || 0,
            lastCheckInDate: data.lastCheckInDate || "0",
            uses2FA: data.uses2FA || false,
            achievements: data.achievements || [],
          };

          setUserInfo(userData);
          setIsCurrentUser(true);
        } else {
          throw new Error('User not found');
        }
      } else {
        throw new Error('User info not available in context');
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

  // load user achievements once userInfo has been loaded
  useEffect(() => {
    const loadAchievements = async () => {
      if (userInfo) {
        if (userInfo.additionalSettings?.hideAchievements) {
          setAchievements([]);
          return;
        }

        const achievementDetails = await getAchievementDetails(userInfo.email, userInfo.achievements);
        setAchievements(achievementDetails);
      }
    }

    loadAchievements();
  }, [userInfo]);

  // fetch activity info on load
  useEffect(() => {
    fetchActivity();
  }, [])

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

  //simple way to get unique and deterministic default profile image for users
  const avatarUri = useMemo(() => {
    if (!userInfo?.username) {
      return Image.resolveAssetSource(require('@assets/images/bonsai-logo.png')).uri;
    }
    const seed = encodeURIComponent(userInfo.username);
    return `https://api.dicebear.com/9.x/fun-emoji/png?seed=${seed}`;
  }, [userInfo?.username]);

  const fetchActivity = async () => {
    try {
      //get user email
      if (!userInfo) {
        console.error("Unable to get user info when fetching activity.");
        return;
      }

      //get activity for this year
      const now = new Date(); //local time
      const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      const activityData: DailyActivityLog[] = await getActivityHistory(userInfo?.email, startOfYear, endOfToday);
      setActivityData(activityData);

      /*
      activityData.forEach((log : DailyActivityLog) => {
        const date = new Date(log.date  + 'T00:00:00Z');
        console.log("On server: " + log.date + " Local time: " + date.toLocaleDateString());
      });
      */

    } catch (error: any) {
      console.error(error);
    }
  }

  const activityCalendarComponents = () => {
    let startIdx = 0;
    const columns = []

    while (startIdx < activityData.length) {
      const buff = [];

      // Check if this batch contains the start of a month
      let label = null;
      for (let i = startIdx; i < Math.min(startIdx + 7, activityData.length); i++) {
        const current = activityData[i];
        const currDate = new Date(current.date);
        if (currDate.getDate() === 1) {
          label = new Intl.DateTimeFormat('en-us', { month: 'short' }).format(currDate);
          break;
        }
      }
    
      // Add label or empty at top
      buff.push(
        <ActivityCalendarDay 
          key={`label-${startIdx}`}
          type={label ? ActivityCalendarDayType.label : ActivityCalendarDayType.empty} 
          label={label || ''}
        />
      );

      //push the next 7 days
      for (let i = startIdx; i < Math.min(startIdx + 7, activityData.length); i++) {
        const current : DailyActivityLog = activityData[i];
        buff.push(
          <ActivityCalendarDay 
            key={current.date} 
            log={current} 
          />
        );
      }

      //add the column
      columns.push(
        <View key={`col-${startIdx}`} className="flex-col flex-nowrap overflow-visible">
          {buff}
        </View>
      )

      startIdx += 7;
    }
    return columns;
  }

  return (
    <ScrollView className="flex-1 bg-stone-950">
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
                source={{ uri: avatarUri }}
                className="w-32 h-32 rounded-3xl border-4 border-stone-950 bg-gray-800"
                resizeMode="contain"
              />
            </View>

            {/* Username */}
            <View className="items-center mt-2">
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
                  className={`flex-row items-center justify-center px-8 py-2 rounded-full ${friendStatus === 'friends' ? 'bg-teal-600' :
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

            {/* Achievements and Streaks */}
            <View>
              {/* Chatbot Check-in Streak */}
              <View className="items-center">
                <Text className="text-white font-bold mt-8">
                  Daily Check-In Streak:
                </Text>
                <GradientText
                  text={userInfo ? String(userInfo.streak) : "0"}
                  classStyle="text-3xl font-bold"
                  size={[800, 40]}
                />
              </View>

              {/* Achievements */}
              <View>
                <Text className="text-white font-bold my-4">
                  Achievements
                </Text>
                {achievements.length === 0 ? (
                  <View className="bg-[#1D1D1D] rounded-2xl items-center p-4 mb-2">
                    <Image
                      source={{ uri: "https://api.dicebear.com/9.x/shapes/png?seed=noAchievements" }}
                      className="h-16 w-16 rounded-full object-cover bg-white mb-2"
                      resizeMode="contain"
                    />
                    <Text className="text-sm text-center text-gray-400">
                      No achievements here! 👀
                    </Text>
                  </View>
                ) : (
                  <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} className="flex-row">
                    {achievements.map((a, index) => (
                      <AchievementItem
                        key={index}
                        url={a.url}
                        title={a.title}
                        description={a.description}
                        classStyle={index < achievements.length - 1 ? "mr-4" : ""}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Activity Calendar */}
              <View className="my-8">
                <Text className="text-white font-bold my-4">
                  Activity
                </Text>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} className="flex-row">
                  <View className="flex flex-row flex-nowrap">
                    {activityCalendarComponents()}
                  </View>
                </ScrollView>
              </View>

            </View>
          </View>

        </View>
      )}
    </ScrollView>
  );
}
