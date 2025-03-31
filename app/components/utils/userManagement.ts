import { db } from 'firebaseConfig';
import { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, updateProfile } from 'firebase/auth';
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
  const auth = getAuth();
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
  const auth = getAuth();
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

export const getAllUsernames = async () => {
  const querySnapshot = await getDocs(collection(db, "users"));
  const usernames = querySnapshot.docs.map((doc) => doc.data().username);
  return usernames;
};