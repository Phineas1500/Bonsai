
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '@/firebaseConfig'; // Import db
import { collection, query, where, getDocs } from 'firebase/firestore'; // Import firestore functions
import { getUserFriendsUsernames } from './utils/userManagement';
import { sendProjectInvite } from './utils/projectManagement';

interface InviteMemberModalProps {
  visible: boolean;
  onRequestClose: () => void;
  projectId: string;
  projectName: string;
  currentMembers: string[]; // Emails of users already in the project
  pendingInvites: string[]; // Emails of users with pending invites
}

interface FriendInfo {
  username: string;
  email: string;
}

// Helper function to get user email from username
// NOTE: This relies on a 'users' collection where documents are keyed by email
// and contain a 'username' field. Adjust if your structure differs.
async function getEmailFromUsername(username: string): Promise<string | null> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Assuming username is unique, return the email from the first match
      const userDoc = querySnapshot.docs[0];
      return userDoc.id; // Document ID is the email in this structure
    } else {
      console.warn(`No user found with username: ${username}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching email for username ${username}:`, error);
    return null;
  }
}

export default function InviteMemberModal({
  visible,
  onRequestClose,
  projectId,
  projectName,
  currentMembers,
  pendingInvites
}: InviteMemberModalProps) {
  const currentUser = auth.currentUser;
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null); // Store email of friend being invited
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFriends = async () => {
      if (!visible || !currentUser?.email) return; // Only fetch when modal is visible and user is logged in

      setLoadingFriends(true);
      setError('');
      setFriends([]); // Clear previous list
      try {
        // 1. Fetch current user's friend usernames
        const friendUsernames = await getUserFriendsUsernames(currentUser.email);

        if (friendUsernames.length === 0) {
          setFriends([]);
          setLoadingFriends(false);
          return;
        }

        // 2. Fetch email for each friend username
        const friendDetailsPromises = friendUsernames.map(async (username) => {
          const email = await getEmailFromUsername(username);
          if (email) {
            return { username, email };
          }
          return null; // Skip if email couldn't be found
        });

        const resolvedFriends = (await Promise.all(friendDetailsPromises)).filter(f => f !== null) as FriendInfo[];

        // 3. Filter out friends who are already members or have pending invites
        const availableFriends = resolvedFriends.filter(friend =>
          !currentMembers.includes(friend.email) && !pendingInvites.includes(friend.email)
        );

        // Sort alphabetically by username
        availableFriends.sort((a, b) => a.username.localeCompare(b.username));

        setFriends(availableFriends);

      } catch (err: any) {
        console.error("Error fetching friends for invite:", err);
        setError("Failed to load friends list.");
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [visible, currentUser, currentMembers, pendingInvites]); // Re-fetch if visibility or project members/invites change


  const handleSendInvite = async (friend: FriendInfo) => {
    setSendingInvite(friend.email);
    setError('');
    try {
      const result = await sendProjectInvite(projectId, friend.email);
      if (result.success) {
        Alert.alert("Invite Sent", `An invitation to join "${projectName}" has been sent to ${friend.username}.`);
        // Remove friend from the list locally after successful invite
        setFriends(prev => prev.filter(f => f.email !== friend.email));
        // Optionally close modal or keep it open to invite more
        // onRequestClose(); // Close after one invite
      } else {
        setError(result.error || "Failed to send invite.");
        Alert.alert("Error", result.error || "Failed to send invite.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      Alert.alert("Error", err.message || "An unexpected error occurred.");
    } finally {
      setSendingInvite(null);
    }
  };

  // Close modal and reset state
  const handleClose = () => {
    setError('');
    setSendingInvite(null);
    // Don't reset friends list immediately, let useEffect handle it on next open
    onRequestClose();
  };


  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <BlurView intensity={30} tint="dark" className="absolute w-full h-full">
        <View className="flex-1 justify-center items-center p-4">
          <View className="bg-stone-900 w-full max-w-md p-5 rounded-xl shadow-lg border border-teal-900/50">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">Invite Friends to Project</Text>
              <TouchableOpacity onPress={handleClose} className="p-1">
                <Feather name="x" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {error ? <Text className="text-red-500 mb-3 text-center">{error}</Text> : null}

            <ScrollView style={{ maxHeight: '60%' }} className="border-t border-b border-stone-700 mb-4">
              {loadingFriends ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="large" color="#14b8a6" />
                  <Text className="text-gray-400 mt-2">Loading friends...</Text>
                </View>
              ) : friends.length === 0 ? (
                <View className="py-10 items-center">
                   <Feather name="users" size={30} color="#555" />
                  <Text className="text-gray-400 mt-3 text-center px-4">
                    No friends available to invite. Either all your friends are already in the project, have a pending invite, or you haven't added any friends yet.
                  </Text>
                </View>
              ) : (
                friends.map((friend) => {
                  const seed = encodeURIComponent(friend.username);
                  const avatarUrl = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${seed}`;
                  const isInvitingThisFriend = sendingInvite === friend.email;

                  return (
                    <View key={friend.email} className="flex-row items-center justify-between py-3 px-2 border-b border-stone-800">
                      <View className="flex-row items-center flex-1 mr-2">
                         <Image
                            source={{ uri: avatarUrl }}
                            className="h-9 w-9 rounded-full mr-3"
                         />
                         <View className="flex-1">
                            <Text className="text-white text-base">{friend.username}</Text>
                            {/* Optionally display email if needed */}
                            {/* <Text className="text-gray-500 text-xs">{friend.email}</Text> */}
                         </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleSendInvite(friend)}
                        disabled={isInvitingThisFriend || !!sendingInvite} // Disable if currently inviting this or any friend
                        className={`py-1.5 px-4 rounded-lg ${isInvitingThisFriend || !!sendingInvite ? 'bg-gray-600' : 'bg-teal-700'}`}
                      >
                        {isInvitingThisFriend ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text className="text-white font-medium text-sm">Invite</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              className="mt-2 py-3 bg-stone-700 rounded-lg items-center"
              onPress={handleClose}
            >
              <Text className="text-white font-bold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}
