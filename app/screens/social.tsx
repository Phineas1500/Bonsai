import { Keyboard, ScrollView, Text, TouchableWithoutFeedback, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import UserLabel from '@components/UserLabel';
import SearchBar from '@components/SearchBar';
import { getAllUsernames } from '@components/utils/userManagement';

export default function Social() {
  const [searchText, setSearchText] = useState('');
  const [allUsernames, setAllUsernames] = useState<string[]>([]);
  const [searchedUsernames, setSearchedUsernames] = useState<string[]>([]);

  // loads all usernames from database on page load
  // loading all usernames on page load right now because database isn't big
  // if database of users becomes super big then we should load usernames on search
  useEffect(() => {
    const fetchAllUsernames = async () => {
      try {
        const usernames = await getAllUsernames();
        setAllUsernames(usernames);
      } catch (error) {
        console.log("error getting usernames");
      }
    };

    fetchAllUsernames();
  }, []);

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

  return (
    <>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View className="flex-1 flex-col items-start bg-stone-950 px-6 pt-6">
          <View className="w-full items-center justify-center">
            {/* <GradientText classStyle="text-center text-4xl font-black" text="Social" size={[200, 50]} /> */}
            <View className="w-full px-2">
              <SearchBar
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search..."
                classStyle="mb-2"
              />
              {searchedUsernames.length > 0 ? (
                <ScrollView>
                  {searchedUsernames.map((username, index) => (
                    <UserLabel
                      key={index}
                      username={username}
                      onPress={() => console.log("pressed ", username)}
                      classStyle="mb-2"
                    />
                  ))}
                </ScrollView>
              ) : (
                <View>
                  <Text className="mt-4 text-white text-center">Search for users</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}