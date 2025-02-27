import { db } from 'firebaseConfig';
import { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import { getAuth, updateProfile } from 'firebase/auth';

export const createUserDocument = async (email: string, username: string, signinType: string) => {
  await setDoc(doc(db, 'users', email.toLowerCase()), {
    email,
    username,
    createdAt: new Date().toISOString(),
    signinType,
  });
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
  if (userData.signinType !== attemptedMethod) {
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

  if (!newUsername) {
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
        return { success: false, error: 'Failed to change username'};
      });
    }
  }
  else {
    console.error('Error: null user');
    return { success: false, error: '' };
  }
  return errMessage ? { success: false, error: errMessage } : { success: true, error: '' };
};