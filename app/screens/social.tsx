import { Keyboard, ScrollView, Text, TouchableWithoutFeedback, View, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import React, { useEffect, useState } from 'react';
import UserLabel from '@components/UserLabel';
import { getAllUsernames, getIncomingFriendRequests, getUserByEmail, acceptFriendRequest, rejectFriendRequest, getUserFriendsUsernames } from '@components/utils/userManagement';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { auth } from '@/firebaseConfig';
import FriendsList from '@components/social/FriendsList';
import ProjectsList from '@components/social/ProjectsList';
import { acceptProjectInvite, getAllProjectInvites, rejectProjectInvite } from '../components/utils/projectManagement';
import { ProjectData } from '../components/utils/ProjectChatManagement';

interface FriendRequest {
  email: string;
  username: string;
}

interface ProjectRequest {
  projectId: string,
  projectName: string;
  creatorUsername: string;
}

export default function Social() {
  const [allUsernames, setAllUsernames] = useState<string[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'projects'>('friends');
  const [projectRequests, setProjectRequests] = useState<ProjectRequest[]>([]);

  // loads all relevant data on page load
  useEffect(() => {
    setLoadingPage(true);
    fetchAllUsernames();
    fetchListFriends();
    loadProjectRequests();
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
      setFriendRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Load all incoming project requests the user has
  const loadProjectRequests = async () => {
    setLoadingRequests(true);
    try {
      const result = await getAllProjectInvites();

      if (result && result.length > 0) {
        // Convert project data list to ProjectRequest objects with usernames
        const requests = await Promise.all(
          result.map(async (project: ProjectData) => {
            const user = await getUserByEmail(project.creatorEmail);
            return {
              projectId: project.id,
              projectName: project.name,
              creatorUsername: user?.data().username || project.creatorEmail
            };
          })
        );
        setProjectRequests(requests);
      } else {
        setProjectRequests([]);
      }
    } catch (error) {
      console.error("Error loading projcet requests:", error);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadFriendRequests();
    loadProjectRequests();
    fetchListFriends();
  };

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

  // Handle accepting a project request
  const handleProjectAcceptRequest = async (projectId: string) => {
    setProcessingRequest(projectId);
    try {
      const result = await acceptProjectInvite(projectId);
      if (result) {
        // Remove from the list
        setProjectRequests(prev => prev.filter(req => req.projectId !== projectId));
        Alert.alert("Success", "Project request accepted");
      } else {
        Alert.alert("Error", "Failed to accept project request");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "An error occurred");
    } finally {
      setProcessingRequest(null);
    }
  };

  // Handle rejecting a project request
  const handleProjectRejectRequest = async (projectId: string) => {
    setProcessingRequest(projectId);
    try {
      const result = await rejectProjectInvite(projectId);
      if (result) {
        // Remove from the list
        setProjectRequests(prev => prev.filter(req => req.projectId !== projectId));
        Alert.alert("Success", "Project request rejected");
      } else {
        Alert.alert("Error", "Failed to reject project request");
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
        <View className="flex-1 flex-col items-start bg-stone-950 px-6">
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
            {(friendRequests.length > 0 && activeTab === 'friends') && (
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

            {/* Project Requests Section */}
            {(projectRequests.length > 0 && activeTab === 'projects') && (
              <View className="mb-6">
                <Text className="text-white text-lg mb-2">Project Requests</Text>

                {projectRequests.map((item, index) => (
                  <View key={item.projectId} className="flex-row items-center justify-between py-3 border-b border-gray-800">
                    <View
                      className="flex-1"
                    >
                      <Text className="text-white">{item.projectName}</Text>
                      <Text className="text-gray-400 text-xs">Invited by {item.creatorUsername}</Text>
                    </View>
                    <View className="flex-row">
                      {processingRequest === item.projectId ? (
                        <ActivityIndicator size="small" color="#14b8a6" />
                      ) : (
                        <>
                          <TouchableOpacity
                            onPress={() => handleProjectAcceptRequest(item.projectId)}
                            className="bg-green-800 p-2 rounded-md mr-2"
                          >
                            <Feather name="check" size={18} color="white" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleProjectRejectRequest(item.projectId)}
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

            {/* Content Section */}
            <View className="w-full px-2 mb-4">
              {/* Tab Navigation */}
              <View className="flex-row mb-4 border-b border-gray-800">
                <TouchableOpacity
                  className={`flex-1 py-2 ${activeTab === 'friends' ? 'border-b-2 border-teal-600' : ''}`}
                  onPress={() => setActiveTab('friends')}
                >
                  <View className="flex-row justify-center items-center">
                    <Feather name="users" size={18} color={activeTab === 'friends' ? '#14b8a6' : 'white'} />
                    <Text className={`ml-2 text-base ${activeTab === 'friends' ? 'text-teal-600 font-medium' : 'text-white'}`}>
                      Friends
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 py-2 ${activeTab === 'projects' ? 'border-b-2 border-teal-600' : ''}`}
                  onPress={() => setActiveTab('projects')}
                >
                  <View className="flex-row justify-center items-center">
                    <Feather name="folder" size={18} color={activeTab === 'projects' ? '#14b8a6' : 'white'} />
                    <Text className={`ml-2 text-base ${activeTab === 'projects' ? 'text-teal-600 font-medium' : 'text-white'}`}>
                      Projects
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Content based on active tab */}
              {activeTab === 'friends' ? (
                <FriendsList
                  friends={friends}
                  loadingPage={loadingPage}
                  refreshing={refreshing}
                  handleUserPress={handleUserPress}
                  allUsernames={allUsernames} // Pass allUsernames for search
                />
              ) : (
                <ProjectsList
                  refreshTrigger={refreshing}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}