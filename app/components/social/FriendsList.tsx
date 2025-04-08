import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import UserLabel from '@components/UserLabel';
import SearchBar from '@components/SearchBar';

interface FriendsListProps {
  friends: string[];
  loadingPage: boolean;
  refreshing: boolean;
  handleUserPress: (username: string) => void;
  allUsernames: string[]; // Added this prop for search functionality
}

const FriendsList = ({
  friends,
  loadingPage,
  refreshing,
  handleUserPress,
  allUsernames
}: FriendsListProps) => {
  const [searchText, setSearchText] = useState('');
  const [searchedUsernames, setSearchedUsernames] = useState<string[]>([]);

  // Search functionality from social.tsx
  useEffect(() => {
    if (searchText.length > 0) {
      const filteredUsernames = allUsernames.filter((username) =>
        username.toLowerCase().includes(searchText.toLowerCase())).sort();
      setSearchedUsernames(filteredUsernames);
    }
    else {
      setSearchedUsernames([]);
    }
  }, [searchText, allUsernames]);

  return (
    <View>
      {/* Search Bar - Moved from social.tsx */}
      <SearchBar
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search users..."
        classStyle="mb-2"
      />

      {/* Search Results */}
      {searchText.length > 0 ? (
        <View>
          {searchedUsernames.length === 0 && !loadingPage && !refreshing ? (
            <View>
              <Text className="text-neutral-500 text-center">No users found!</Text>
            </View>
          ) : (
            searchedUsernames.map((username, index) => (
              <UserLabel
                key={index}
                username={username}
                onPress={() => handleUserPress(username)}
                classStyle="mb-2"
                friend={friends.includes(username)}
              />
            ))
          )}

        </View>
      ) : (
        // Original friends list when not searching
        <View>
          {friends.length > 0 ? (
            // If user has friends
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
            // If the user has no friends
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
  );
};

export default FriendsList;
