import { auth, db } from '@/firebaseConfig';
import { arrayUnion, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { getUserByEmail } from './userManagement';

// Achievement type
export type Achievement = {
  url: string;
  title: string;
  description: string;
};

// Gets list of user's achievement details given the list of achievements
export const getAchievementDetails = async (email: string, achievements: string[] | undefined) => {
  try {
    const user = auth.currentUser;
    if (user == null || user.email == null) {
      throw new Error('User not found');
    }

    // if no achievements (add getting started achievement)
    if (!achievements || achievements.length == 0) {
      const newAchievement = "gettingStarted";
      // if current user, updated in db
      if (email == user.email) {
        await updateAchievements(user.email, newAchievement);
      }
      achievements = [newAchievement];
    }

    const achievementDetails = achievements.map((name: any) => ({
      ...listOfAchievements[name]
    }));
    const list = achievementDetails.toReversed();

    return list;
  } catch (e) {
    console.error('Error getting achievements: ', e);
    return [];
  }
};

// Updates list of user's achievements in db
export const updateAchievements = async (userEmail: string, newAchievement: string) => {
  try {
    await updateDoc(doc(db, "users", userEmail), {
      achievements: arrayUnion(newAchievement)
    });
  } catch (e) {
    console.error('Error updating achievements: ', e);
  }
};

// Check if a user has obtained a friend achievement
/* Takes in userEmail as a parameter because this can be triggered through the action
   of another user */
export const checkFriendAchievement = async (userEmail: string) => {
  try {

  } catch (e) {
    console.error('Error checking if new friend achievement obtained: ', e);
  }
};

// Check if a user has obtained a project achievement
export const checkProjectAchievement = async () => {
  try {

  } catch (e) {
    console.error('Error checking if new project achievement obtained: ', e);
  }
};

// Check if a user has obtained a streak achievement
export const checkStreakAchievement = async () => {
  try {

  } catch (e) {
    console.error('Error checking if new streak achievement obtained: ', e);
  }
};

// List of achievements a user can obtain
export const listOfAchievements: Record<string, Achievement> = {
  "gettingStarted": {
    url: "",
    title: "Getting Started",
    description: "Create a Bonsai account"
  },
  "firstFriend": {
    url: "",
    title: "Team Builder",
    description: "Become friends with another user"
  },
  "fiveFriends": {
    url: "",
    title: "Network Starter",
    description: "Become friends with 5 other users"
  },
  "tenFriends": {
    url: "",
    title: "Collaboration Hub",
    description: "Become friends with 10 other users"
  },
  "firstProject": {
    url: "",
    title: "Project Kickoff",
    description: "Create or join a project"
  },
  "perfectWeek": {
    url: "",
    title: "Solid Start",
    description: "Obtain a 7 day check-in streak"
  },
  "tenStreak": {
    url: "",
    title: "Streak Seeker",
    description: "Obtain a 10 day check-in streak"
  },
  "twentyStreak": {
    url: "",
    title: "Momentum Builder",
    description: "Obtain a 20 day check-in streak"
  },
  "perfectMonth": {
    url: "",
    title: "Consistency Champ",
    description: "Obtain a 30 day check-in streak"
  },
};