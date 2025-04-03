import { db } from 'firebaseConfig';
import { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth } from 'firebaseConfig';
import { deleteChat } from '@components/utils/chatManagement';

export const createUserDocument = async (email: string, username: string, signinType: string) => {
  const docRef = doc(db, 'users', email.toLowerCase());
  const docSnap = await getDoc(docRef);

  // Only create if it doesn't exist
  if (!docSnap.exists()) {
    await setDoc(doc(db, 'users', email.toLowerCase()), {
      email,
      username,
      createdAt: new Date().toISOString(),
      signinType,
      friends: [],
      incomingFriendRequests: [],
      outgoingFriendRequests: [],
      streak: 0,
      lastCheckInDate: "0"
    });
    console.log('User document created:', email);
  }
};

export const getUserByEmail = async (email: string) => {
  const userDoc = await getDoc(doc(db, 'users', email.toLowerCase()));

  if (!userDoc.exists()) {
    return null;
  }

  return {
    id: userDoc.data().email,
    data: () => userDoc.data()
  };
};

export const getUserByUsername = async (username: string) => {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  return querySnapshot.docs[0];
};

export const validateSignInMethod = async (email: string, attemptedMethod: string) => {
  const user = await getUserByEmail(email);
  if (!user) return { exists: false, error: null };

  const userData = user.data();

  // only if signintype was google and they want to sign in with email, fail it
  if (userData.signinType == "google" && attemptedMethod == "email") {
    return {
      exists: true,
      error: `This account was created using ${userData.signinType}. Please sign in with ${userData.signinType} instead.`
    };
  }

  return { exists: true, error: null };
};

export const changeUsername = async (currentUsername: string, newUsername: string) => {

  const user = auth.currentUser;
  var errMessage = '';

  if (!newUsername || currentUsername == newUsername) {
    return { success: false, error: 'Enter a new username' };
  }

  if (user != null && user.email != null) {
    // check if username is taken
    const existingUser = await getUserByUsername(newUsername);
    if (existingUser) {
      errMessage = 'Username is already taken';
    }
    else {
      // update displayName in auth
      await updateProfile(user, {
        displayName: newUsername
      }).then(() => {
        console.log('Username updated in auth:', user.displayName);
      }).catch((error) => {
        console.error('Error:', error);
        return { success: false, error: 'Failed to change username' };
      });

      // update username in firestore
      await updateDoc(doc(db, "users", user.email), {
        username: newUsername
      }).then(() => {
        console.log('Changed username to', newUsername);
      }).catch((error) => {
        console.error('Error:', error);
        return { success: false, error: 'Failed to change username' };
      });
    }
  }
  else {
    console.error('Error: null user');
    return { success: false, error: '' };
  }
  return errMessage ? { success: false, error: errMessage } : { success: true, error: '' };
};

export const deleteUserAccount = async () => {

  const user = auth.currentUser;
  if (user) {
    // delete all associated data in db
    if (user.email) {
      // delete user's chats
      await deleteChat(user.email);

      await deleteDoc(doc(db, 'users', user.email.toLowerCase()))
        .then(() => {
          console.log('User data deleted from firestore database');
        }).catch((error) => {
          console.error('Error:', error);
        });
    }

    // delete in auth
    await user.delete()
      .then(() => {
        console.log('User deleted from firebase auth');
      }).catch((error) => {
        console.error('Error:', error);
      });
  }
  else {
    throw new Error('Error getting user');
  }
};

export const updateUserStreak = async (userEmail: string) => {
  try {
    const user = await getUserByEmail(userEmail);
    if (!user) throw new Error('Error getting user');

    // compare last time user checked in
    const lastCheckInDate = user.data().lastCheckInDate ? new Date(user.data().lastCheckInDate) : new Date(0);
    const currentDate = new Date();
    const timeDiff = currentDate.getTime() - lastCheckInDate.getTime();
    const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));

    // if difference between currentDate and lastCheckInDate is greater than 24 hours update or lose streak
    if (hoursDiff >= 24) {
      // if last check in was less than 48 hours ago, update streak by one
      if (hoursDiff <= 48) {
        await updateDoc(doc(db, "users", userEmail), {
          streak: user.data().streak + 1,
          lastCheckInDate: new Date().toISOString()
        });
      }
      // else user loses their streak
      else {
        await updateDoc(doc(db, "users", userEmail), {
          streak: 0,
          lastCheckInDate: new Date().toISOString()
        });
      }
      console.log("User streak updated");
      return true;
    }
    // if last check in time is less than 24 hours, streak doesn't update
    else {
      console.log("User already checked in with chatbot within last 24 hours");
      return false;
    }
  } catch (error: any) {
    console.error(error);
    return false;
  }
}

export const getAllUsernames = async () => {
  const querySnapshot = await getDocs(collection(db, "users"));
  const usernames = querySnapshot.docs.map((doc) => doc.data().username);
  return usernames;
};


/////////////////////////////// Friend management functions ///////////////////////////////////////

/**
 * Send a friend request from current user to another user
 */
export const sendFriendRequest = async (toUserEmail: string) => {
  try {

    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      throw new Error("You must be logged in to send friend requests");
    }

    const fromUserEmail = currentUser.email.toLowerCase();
    const sanitizedToEmail = toUserEmail.toLowerCase();

    // Ensure both users have friend arrays
    await ensureFriendArrays(fromUserEmail);
    await ensureFriendArrays(sanitizedToEmail);

    // Check if users aren't already friends or have pending requests
    const fromUser = await getUserByEmail(fromUserEmail);
    if (!fromUser) throw new Error("Current user not found");

    const fromUserData = fromUser.data();
    const friends = fromUserData.friends || [];
    const outgoing = fromUserData.outgoingFriendRequests || [];

    if (friends.includes(sanitizedToEmail)) {
      return { success: false, error: "You are already friends with this user" };
    }

    if (outgoing.includes(sanitizedToEmail)) {
      return { success: false, error: "You already sent a request to this user" };
    }

    // Add to current user's outgoing requests
    await updateDoc(doc(db, "users", fromUserEmail), {
      outgoingFriendRequests: arrayUnion(sanitizedToEmail)
    });

    // Add to recipient's incoming requests
    await updateDoc(doc(db, "users", sanitizedToEmail), {
      incomingFriendRequests: arrayUnion(fromUserEmail)
    });

    return { success: true, error: "" };
  } catch (error: any) {
    console.error("Error sending friend request:", error);
    return { success: false, error: error.message || "Failed to send friend request" };
  }
};

/**
 * Accept a friend request
 */
export const acceptFriendRequest = async (fromUserEmail: string) => {
  try {

    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      throw new Error("You must be logged in to accept friend requests");
    }

    const toUserEmail = currentUser.email.toLowerCase();
    const sanitizedFromEmail = fromUserEmail.toLowerCase();

    // Ensure both users have friend arrays
    await ensureFriendArrays(toUserEmail);
    await ensureFriendArrays(sanitizedFromEmail);

    // Remove from incoming requests
    await updateDoc(doc(db, "users", toUserEmail), {
      incomingFriendRequests: arrayRemove(sanitizedFromEmail),
      friends: arrayUnion(sanitizedFromEmail)
    });

    // Remove from sender's outgoing and add to friends
    await updateDoc(doc(db, "users", sanitizedFromEmail), {
      outgoingFriendRequests: arrayRemove(toUserEmail),
      friends: arrayUnion(toUserEmail)
    });

    return { success: true, error: "" };
  } catch (error: any) {
    console.error("Error accepting friend request:", error);
    return { success: false, error: error.message || "Failed to accept friend request" };
  }
};

/**
 * Reject a friend request
 */
export const rejectFriendRequest = async (fromUserEmail: string) => {
  try {

    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      throw new Error("You must be logged in to reject friend requests");
    }

    const toUserEmail = currentUser.email.toLowerCase();
    const sanitizedFromEmail = fromUserEmail.toLowerCase();

    // Ensure both users have friend arrays
    await ensureFriendArrays(toUserEmail);
    await ensureFriendArrays(sanitizedFromEmail);

    // Remove from incoming requests
    await updateDoc(doc(db, "users", toUserEmail), {
      incomingFriendRequests: arrayRemove(sanitizedFromEmail)
    });

    // Remove from sender's outgoing
    await updateDoc(doc(db, "users", sanitizedFromEmail), {
      outgoingFriendRequests: arrayRemove(toUserEmail)
    });

    return { success: true, error: "" };
  } catch (error: any) {
    console.error("Error rejecting friend request:", error);
    return { success: false, error: error.message || "Failed to reject friend request" };
  }
};

/**
 * Remove a friend
 */
export const removeFriend = async (friendEmail: string) => {
  try {

    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      throw new Error("You must be logged in to remove friends");
    }

    const userEmail = currentUser.email.toLowerCase();
    const sanitizedFriendEmail = friendEmail.toLowerCase();

    // Ensure both users have friend arrays
    await ensureFriendArrays(userEmail);
    await ensureFriendArrays(sanitizedFriendEmail);

    // Remove from both users' friends lists
    await updateDoc(doc(db, "users", userEmail), {
      friends: arrayRemove(sanitizedFriendEmail)
    });

    await updateDoc(doc(db, "users", sanitizedFriendEmail), {
      friends: arrayRemove(userEmail)
    });

    return { success: true, error: "" };
  } catch (error: any) {
    console.error("Error removing friend:", error);
    return { success: false, error: error.message || "Failed to remove friend" };
  }
};

/**
 * Cancel an outgoing friend request
 */
export const cancelFriendRequest = async (toUserEmail: string) => {
  try {

    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      throw new Error("You must be logged in to cancel friend requests");
    }

    const fromUserEmail = currentUser.email.toLowerCase();
    const sanitizedToEmail = toUserEmail.toLowerCase();

    // Ensure both users have friend arrays
    await ensureFriendArrays(fromUserEmail);
    await ensureFriendArrays(sanitizedToEmail);

    // Remove from current user's outgoing
    await updateDoc(doc(db, "users", fromUserEmail), {
      outgoingFriendRequests: arrayRemove(sanitizedToEmail)
    });

    // Remove from recipient's incoming
    await updateDoc(doc(db, "users", sanitizedToEmail), {
      incomingFriendRequests: arrayRemove(fromUserEmail)
    });

    return { success: true, error: "" };
  } catch (error: any) {
    console.error("Error canceling friend request:", error);
    return { success: false, error: error.message || "Failed to cancel friend request" };
  }
};

/**
 * Check friendship status between current user and another user
 * Returns: 'none', 'friends', 'incoming', 'outgoing'
 */
export const getFriendshipStatus = async (otherUserEmail: string) => {
  try {

    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      throw new Error("You must be logged in to check friendship status");
    }

    const userEmail = currentUser.email.toLowerCase();
    const sanitizedOtherEmail = otherUserEmail.toLowerCase();

    // Ensure both users have friend arrays
    await ensureFriendArrays(userEmail);
    await ensureFriendArrays(sanitizedOtherEmail);

    const userDoc = await getUserByEmail(userEmail);
    if (!userDoc) throw new Error("Current user not found");

    const userData = userDoc.data();
    const friends = userData.friends || [];
    const outgoing = userData.outgoingFriendRequests || [];
    const incoming = userData.incomingFriendRequests || [];

    if (friends.includes(sanitizedOtherEmail)) {
      return { status: 'friends', error: "" };
    }

    if (outgoing.includes(sanitizedOtherEmail)) {
      return { status: 'outgoing', error: "" };
    }

    if (incoming.includes(sanitizedOtherEmail)) {
      return { status: 'incoming', error: "" };
    }

    return { status: 'none', error: "" };
  } catch (error: any) {
    console.error("Error checking friendship status:", error);
    return { status: 'error', error: error.message || "Failed to check friendship status" };
  }
};

/**
 * Get the list of friends for a user
 */
export const getUserFriends = async (userEmail: string) => {
  try {
    // Ensure user has friend arrays
    await ensureFriendArrays(userEmail.toLowerCase());

    const userDoc = await getUserByEmail(userEmail.toLowerCase());
    if (!userDoc) throw new Error("User not found");

    const userData = userDoc.data();
    return { friends: userData.friends || [], error: "" };
  } catch (error: any) {
    console.error("Error getting user friends:", error);
    return { friends: [], error: error.message || "Failed to get user friends" };
  }
};

/**
 * Get the list of friends for a user by usernames (getUserFriends() returns list of emails)
 */
export const getUserFriendsUsernames = async (userEmail: string) => {
  try {
    const friends = await getUserFriends(userEmail);
    const emails = friends.friends;
    const usernames = await Promise.all(
      emails.map(async (email: string) => {
        const user = await getUserByEmail(email);
        if (!user) throw new Error("User not found");
        return user.data().username;
      })
    );
    return usernames;
  } catch (error: any) {
    console.error("Error getting user friends:", error);
    return [];
  }
}

/**
 * Get incoming friend requests for current user
 */
export const getIncomingFriendRequests = async () => {
  try {

    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      throw new Error("You must be logged in to get friend requests");
    }

    // Ensure user has friend arrays
    await ensureFriendArrays(currentUser.email.toLowerCase());

    const userDoc = await getUserByEmail(currentUser.email.toLowerCase());
    if (!userDoc) throw new Error("User not found");

    const userData = userDoc.data();
    return { requests: userData.incomingFriendRequests || [], error: "" };
  } catch (error: any) {
    console.error("Error getting friend requests:", error);
    return { requests: [], error: error.message || "Failed to get friend requests" };
  }
};


// Ensure user document has friend arrays (helper function)
const ensureFriendArrays = async (email: string) => {
  const userRef = doc(db, 'users', email.toLowerCase());
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const userData = userSnap.data();
    const updates: { [key: string]: any } = {};

    if (!userData.friends) updates.friends = [];
    if (!userData.incomingFriendRequests) updates.incomingFriendRequests = [];
    if (!userData.outgoingFriendRequests) updates.outgoingFriendRequests = [];

    // Only update if any field was missing
    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
      console.log(`Updated friend arrays for user: ${email}`);
    }
  }
};
