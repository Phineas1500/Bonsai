import { Keyboard, ScrollView, Text, TouchableWithoutFeedback, View, RefreshControl, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import React, { useEffect, useState } from 'react';
import UserLabel from '@components/UserLabel';
import SearchBar from '@components/SearchBar';
import { getAllUsernames, getIncomingFriendRequests, getUserByEmail, acceptFriendRequest, rejectFriendRequest, getUserFriendsUsernames } from '@components/utils/userManagement';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { auth } from '@/firebaseConfig';

interface FriendRequest {
  email: string;
  username: string;
}

export default function Social() {
  const [searchText, setSearchText] = useState('');
  const [allUsernames, setAllUsernames] = useState<string[]>([]);
  const [searchedUsernames, setSearchedUsernames] = useState<string[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);

  // loads all relevant data on page load
  useEffect(() => {
    setLoadingPage(true)
    fetchAllUsernames();
    fetchListFriends();
    loadFriendRequests();
  }, []);

  // loads all usernames from database on page load
  // loading all usernames on page load right now because database isn't big
  // if database of users becomes super big then we should load usernames on search
  const fetchAllUsernames = async () => {
    try {
      const usernames = await getAllUsernames();
      setAllUsernames(usernames);
    } catch (error) {
      console.log("error getting usernames");
    }
  };

  // loads list of user's friends
  const fetchListFriends = async () => {
    try {
      const user = auth.currentUser;
      if (user && user.email) {
        const listOfFriends = await getUserFriendsUsernames(user.email);
        setFriends(listOfFriends);
      }
    } catch (error) {
      console.log("error getting list of friends");
    } finally {
      setLoadingPage(false);
      setRefreshing(false);
    }
  };

  // Function to load incoming friend requests
  const loadFriendRequests = async () => {
    setLoadingRequests(true);
    try {
      const result = await getIncomingFriendRequests();

      if (result.requests && result.requests.length > 0) {
        // Convert email list to FriendRequest objects with usernames
        const requestsWithUsernames = await Promise.all(
          result.requests.map(async (email: string) => {
            const user = await getUserByEmail(email);
            return {
              email,
              username: user?.data().username || email
            };
          })
        );
        setFriendRequests(requestsWithUsernames);
      } else {
        setFriendRequests([]);
      }
    } catch (error) {
      console.error("Error loading friend requests:", error);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadFriendRequests();
    fetchListFriends();
  };

  // filters through list of all usernames based on user's search
  useEffect(() => {
    if (searchText.length > 0) {
      const filteredUsernames = allUsernames.filter((allUsernames) =>
        allUsernames.toLowerCase().includes(searchText.toLowerCase())).sort();
      setSearchedUsernames(filteredUsernames);
    }
    else {
      setSearchedUsernames([]);
    }
  }, [searchText, allUsernames]);

  // navigate to profile page with the selected username
  const handleUserPress = (username: string) => {
    router.push({
      pathname: '/screens/profile',
      params: { username }
    });
  };

  // Handle accepting a friend request
  const handleAcceptRequest = async (email: string) => {
    setProcessingRequest(email);
    try {
      const result = await acceptFriendRequest(email);
      if (result.success) {
        // Remove from the list
        setFriendRequests(prev => prev.filter(req => req.email !== email));
        Alert.alert("Success", "Friend request accepted!");
      } else {
        Alert.alert("Error", result.error || "Failed to accept friend request");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "An error occurred");
    } finally {
      setProcessingRequest(null);
    }
  };

  // Handle rejecting a friend request
  const handleRejectRequest = async (email: string) => {
    setProcessingRequest(email);
    try {
      const result = await rejectFriendRequest(email);
      if (result.success) {
        // Remove from the list
        setFriendRequests(prev => prev.filter(req => req.email !== email));
        Alert.alert("Success", "Friend request rejected");
      } else {
        Alert.alert("Error", result.error || "Failed to reject friend request");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "An error occurred");
    } finally {
      setProcessingRequest(null);
    }
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View className="flex-1 flex-col items-start bg-stone-950 px-6 pt-6">
          <ScrollView
            className="w-full"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#14b8a6"
              />
            }
          >
            {/* Friend Requests Section */}
            {friendRequests.length > 0 && (
              <View className="mb-6">
                <Text className="text-white text-lg mb-2">Friend Requests</Text>

                {friendRequests.map((item, index) => (
                  <View key={item.email} className="flex-row items-center justify-between py-3 border-b border-gray-800">
                    <TouchableOpacity
                      className="flex-1"
                      onPress={() => handleUserPress(item.username)}
                    >
                      <Text className="text-white">{item.username}</Text>
                    </TouchableOpacity>
                    <View className="flex-row">
                      {processingRequest === item.email ? (
                        <ActivityIndicator size="small" color="#14b8a6" />
                      ) : (
                        <>
                          <TouchableOpacity
                            onPress={() => handleAcceptRequest(item.email)}
                            className="bg-green-800 p-2 rounded-md mr-2"
                          >
                            <Feather name="check" size={18} color="white" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRejectRequest(item.email)}
                            className="bg-red-800 p-2 rounded-md"
                          >
                            <Feather name="x" size={18} color="white" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Search Section */}
            <View className="w-full px-2 mb-4">
              <SearchBar
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search users..."
                classStyle="mb-4"
              />
              {/* If user is typing in the user search bar */}
              {searchedUsernames.length > 0 ? (
                <View>
                  {searchedUsernames.map((username, index) => (
                    <UserLabel
                      key={index}
                      username={username}
                      onPress={() => handleUserPress(username)}
                      classStyle="mb-2"
                      friend={friends.includes(username)}
                    />
                  ))}
                </View>
              ) : (
                <View>
                  <View className="flex-row items-center mb-2">
                    <Text className="text-white text-lg mr-2">Friends</Text>
                    <Feather name="users" size={18} color="white" />
                  </View>
                  {friends.length > 0 ? (
                    // If user isn't typing in user search bar and has friends
                    <View>
                      {friends.map((username, index) => (
                        <UserLabel
                          key={index}
                          username={username}
                          onPress={() => handleUserPress(username)}
                          classStyle="mb-2"
                        />
                      ))}
                    </View>
                  ) : (
                    // If the user isn't typing in the user search bar and has no friends
                    <View>
                      {(loadingPage || refreshing) ? (
                        <View className="flex-1 justify-center items-center">
                          <ActivityIndicator size="large" color="#14b8a6" />
                        </View>
                      ) : (
                        <View>
                          <Text className="text-white text-center">You have not added anyone as a friend yet!</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}