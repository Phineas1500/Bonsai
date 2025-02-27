import { db } from 'firebaseConfig';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';

export const createUserDocument = async (email: string, username: string, signinType: string) => {
  await setDoc(doc(db, 'users', username.toLowerCase()), {
    email,
    username,
    createdAt: new Date().toISOString(),
    signinType,
  });
};

export const getUserByUsername = async (username: string) => {
  const userDoc = await getDoc(doc(db, 'users', username.toLowerCase()));

  if (!userDoc.exists()) {
    return null;
  }

  return {
    id: userDoc.data().email,
    data: () => userDoc.data()
  };
};


export const getUserByEmail = async (email: string) => {
  const q = query(collection(db, 'users'), where('email', '==', email));
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
  // check if username is taken
  // update username

  return { success: false, error: 'test' };
};