import { auth, db } from '@/firebaseConfig';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { getUserByEmail } from './userManagement';
import { sendPushNotification } from './notificationAPI';

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

    const achievementDetails = achievements
      .filter((name: any) => listOfAchievements[name]) // only keep valid names
      .map((name: any) => ({
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
    await sendAchievementNotification(userEmail, newAchievement);
  } catch (e) {
    console.error('Error updating achievements: ', e);
  }
};

export const sendAchievementNotification = async (userEmail: string, newAchievement: string) => {
  const user = await getUserByEmail(userEmail);
  if (!user) throw new Error('Error getting user');

  const userInfo = user.data();
  const notifPrefs = userInfo.notificationPreferences;
  if (!notifPrefs) {
    console.log("Sending user doesn't have notification preferences");
    return;
  }
  if (notifPrefs.notificationsEnabled) {
    // Send notification of new achievement
    sendPushNotification({
      email: userEmail,
      title: 'New Achievement Earned!',
      body: `You have earned the achievement ${listOfAchievements[newAchievement].title}`,
      data: {}
    });
  }
};

// Getting started achievement on account creation
export const gettingStartedAchievement = async () => {
  try {
    const user = auth.currentUser;
    if (user == null || user.email == null) {
      throw new Error('User not found');
    }
    await updateAchievements(user.email, "gettingStarted");
  } catch (e) {
    console.error('Error awarding getting started achievement: ', e);
  }
};

// Check if a user has obtained a friend achievement
/* Takes in userEmail as a parameter because this can be triggered through the action
   of another user */
export const checkFriendAchievement = async (userEmail: string) => {
  try {
    const user = await getUserByEmail(userEmail);
    if (!user) throw new Error('Error getting user');

    const numFriends = user.data().friends.length;
    switch (numFriends) {
      case 1:
        await updateAchievements(user.data().email, "firstFriend");
        break;
      case 5:
        await updateAchievements(user.data().email, "fiveFriends");
        break;
      case 10:
        await updateAchievements(user.data().email, "tenFriends");
        break;
      default:
    }
  } catch (e) {
    console.error('Error checking if new friend achievement obtained: ', e);
  }
};

// Check if a user has obtained a project achievement
export const checkProjectAchievement = async (numProjects: number) => {
  try {
    const user = auth.currentUser;
    if (user == null || user.email == null) {
      throw new Error('User not found');
    }

    switch (numProjects) {
      case 1:
        await updateAchievements(user.email, "firstProject");
        break;
      default:
    }
  } catch (e) {
    console.error('Error checking if new project achievement obtained: ', e);
  }
};

// Check if a user has obtained a streak achievement
export const checkStreakAchievement = async (streak: number) => {
  try {
    const user = auth.currentUser;
    if (user == null || user.email == null) {
      throw new Error('User not found');
    }

    switch (streak) {
      case 7:
        await updateAchievements(user.email, "perfectWeek");
        break;
      case 10:
        await updateAchievements(user.email, "tenStreak");
        break;
      case 20:
        await updateAchievements(user.email, "twentyStreak");
        break;
      case 30:
        await updateAchievements(user.email, "perfectMonth");
        break;
      default:
    }
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