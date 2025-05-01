import { auth, db } from '@/firebaseConfig';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { getUserByEmail } from './userManagement';
import axios from 'axios'; // Import axios
import { UserInfo } from '@contexts/UserContext'; // Import UserInfo type
import { ProjectData as FullProjectData } from './ProjectChatManagement'; // Use the more complete interface
import { NotificationPreferences, NotificationTrigger } from '@/app/contexts/NotificationContext';
import { sendPushNotification } from './notificationAPI';

export interface ProjectMember {
  email: string;
  username: string;
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: Timestamp;
  creatorEmail: string;
  members: ProjectMember[];
  pendingInvites: string[];
  sharedCalendarId?: string; // Added field
}

// Modify createProject to accept calendarAuth
export const createProject = async (
  email: string,
  projectName: string,
  calendarAuth?: UserInfo['calendarAuth'] // Add calendarAuth parameter
) => {
  let projectId: string | null = null;
  try {
    const userDoc = await getUserByEmail(email);
    if (!userDoc) {
      throw new Error("User not found");
    }
    const username = userDoc.data()?.username;
    if (!username) {
      throw new Error("Username not found for creator");
    }

    // Create project document first
    const docRef = await addDoc(collection(db, 'projects'), {
      createdAt: new Date(),
      creatorEmail: email,
      name: projectName,
      members: [
        { email: email, username: username },
      ],
      pendingInvites: [],
      sharedCalendarId: null // Initialize as null
    });
    projectId = docRef.id;
    console.log('New project document created:', projectId);

    // --- Create Shared Google Calendar ---
    if (calendarAuth?.access_token) {
      console.log("Attempting to create shared Google Calendar...");
      try {
        const calendarResponse = await axios.post(
          'https://www.googleapis.com/calendar/v3/calendars',
          {
            summary: `Bonsai Project: ${projectName}` // Calendar Name
          },
          {
            headers: {
              Authorization: `Bearer ${calendarAuth.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (calendarResponse.status === 200 || calendarResponse.status === 201) {
          const calendarId = calendarResponse.data.id;
          console.log('Shared Google Calendar created with ID:', calendarId);

          // Update the project document with the calendar ID
          await updateDoc(doc(db, 'projects', projectId), {
            sharedCalendarId: calendarId
          });
          console.log('Project document updated with sharedCalendarId.');

          // TODO: Add initial members (creator) to the calendar ACL?
          // This might require additional permissions/logic. For now, only creator has access.

        } else {
          console.warn('Failed to create shared Google Calendar:', calendarResponse.status, calendarResponse.data);
          // Proceed without shared calendar if creation fails
        }
      } catch (calendarError: any) {
        console.error('Error creating shared Google Calendar:', calendarError.response?.data || calendarError.message);
        // Proceed without shared calendar if creation fails
      }
    } else {
      console.log("Skipping shared calendar creation: User not signed in with Google or missing calendar auth.");
    }
    // --- End Calendar Creation ---

    return true; // Project document creation was successful
  } catch (e) {
    console.error('Error creating project: ', e);
    // Optional: Clean up Firestore document if calendar creation was the goal and it failed?
    // For now, we keep the project document even if calendar fails.
    return false;
  }
};

export const deleteProject = async (email: string, projectId: string) => {
  try {
    // get project from db
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (projectSnap.exists()) {
      // check if user is creator (should already be the case, this is just a double check)
      const creator = projectSnap.data().creatorEmail;
      if (email != creator) {
        throw new Error('Invalid permissions');
      }

      // delete project
      await deleteDoc(projectRef)
        .then(() => {
          console.log('Project data deleted from firestore');
        }).catch((error) => {
          throw new Error(error);
        });
    }
    else {
      throw new Error('Project not found');
    }
  } catch (e) {
    console.error('Error deleting project: ', e);
  }
};

export const getAllProjectInvites = async () => {
  // Currently looping through all projects and finding ones where user has an invite
  // Can change if we decide to have each user maintain a list of invites in db for efficiency
  try {
    // Get current user
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      throw new Error("You must be logged in to get project requests");
    }

    // Query for projects where the user has a pending invite
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, where('pendingInvites', 'array-contains', currentUser.email.toLowerCase()));
    const querySnapshot = await getDocs(q);

    const projectList: ProjectData[] = [];
    querySnapshot.forEach((doc) => {
      projectList.push({
        id: doc.id,
        ...doc.data() as Omit<ProjectData, 'id'>
      });
    });

    // Sort projects by name
    projectList.sort((a, b) => a.name.localeCompare(b.name));
    return projectList;

  } catch (e) {
    console.error('Error fetching project invites: ', e);
  };
};

export const acceptProjectInvite = async (projectId: string) => {
  try {
    // get current user
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      throw new Error("You must be logged in to get project requests");
    }
    const email = currentUser.email;

    // remove email from pendingInvites array
    await updateDoc(doc(db, "projects", projectId), {
      pendingInvites: arrayRemove(email)
    });

    // add username and email to members array
    const user = await getUserByEmail(email);
    const projectRef = doc(db, 'projects', projectId);
    const username = user.data().username;
    console.log(email, username);
    await updateDoc(projectRef, {
      members: arrayUnion({ email, username })
    });

    return true;
  } catch (e) {
    console.error('Error accepting project invite', e);
    return false;
  }
};

export const rejectProjectInvite = async (projectId: string) => {
  try {
    // get current user
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      throw new Error("You must be logged in to get project requests");
    }
    const email = currentUser.email;

    // remove email from pendingInvites array
    await updateDoc(doc(db, "projects", projectId), {
      pendingInvites: arrayRemove(email)
    });

    return true;
  } catch (e) {
    console.error('Error rejecting project invite', e);
    return false;
  }
};

// send push notification project invite to user with friendEmail
const sendInviteNotification = async (friendEmail: string, projectData: Omit<ProjectData, 'id'>) => {
  try {
    // fetch user data for the friend
    const friendUser = await getUserByEmail(friendEmail);
    if (!friendUser) throw new Error("Unable to fetch user info for friend to invite to project.");
    const friendUserInfo = friendUser.data() as UserInfo;
    const notifPrefs = friendUserInfo.notificationPreferences as NotificationPreferences;
    if (!notifPrefs) throw new Error("Unable to fetch notification preferences for friend");

    //fetch user data for the project owner
    const invitingUser = await getUserByEmail(projectData.creatorEmail);
    if (!invitingUser) throw new Error("Unable to fetch user info for project creator.");
    const invitingUserInfo = invitingUser.data() as UserInfo;

    //notify that project owner has invited the friend
    //only do so if notifications are enabled for this type of trigger 
    if (notifPrefs.notificationsEnabled) {
      if (notifPrefs.triggers.includes(NotificationTrigger.ProjectInvites)) {
        sendPushNotification({
          email: friendEmail,
          title: 'New Project Invite',
          body: `${invitingUserInfo.username} has invited you to join their project ${projectData.name}`,
          data: {}
        })
      }
    }

  } catch (error: any) {
    console.error("Error sending project invite notification", error);
  }
}

export const sendProjectInvite = async (projectId: string, friendEmail: string) => {
  try {
    // get current user
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      throw new Error("You must be logged in to send project invites");
    }

    // get project data
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const projectData = projectSnap.data() as Omit<ProjectData, 'id'>;

    // Check if user is the creator (or maybe allow members to invite later?)
    // For now, only creator can invite
    if (projectData.creatorEmail !== currentUser.email) {
      throw new Error('Only the project creator can invite members.');
    }

    // Check if the friend is already a member
    const isMember = projectData.members.some(member => member.email === friendEmail);
    if (isMember) {
      throw new Error('This user is already a member of the project.');
    }

    // Check if the friend already has a pending invite
    const hasPendingInvite = projectData.pendingInvites.includes(friendEmail);
    if (hasPendingInvite) {
      throw new Error('This user already has a pending invite.');
    }

    // Add friend's email to pendingInvites array
    await updateDoc(projectRef, {
      pendingInvites: arrayUnion(friendEmail.toLowerCase())
    });

    // Possibly notify the friend that they've been invited to a project
    sendInviteNotification(friendEmail, projectData);

    console.log(`Invite sent to ${friendEmail} for project ${projectId}`);
    return { success: true };
  } catch (e: any) {
    console.error('Error sending project invite', e);
    return { success: false, error: e.message || 'Failed to send invite.' };
  }
};

export const cancelProjectInvite = async (projectId: string, inviteEmail: string) => {
  try {
    // get current user
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      throw new Error("You must be logged in to cancel project invites");
    }

    // get project data to verify creator
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }
    const projectData = projectSnap.data() as Omit<ProjectData, 'id'>;
    if (projectData.creatorEmail !== currentUser.email) {
      throw new Error('Only the project creator can cancel invites.');
    }

    // remove email from pendingInvites array
    await updateDoc(projectRef, {
      pendingInvites: arrayRemove(inviteEmail)
    });

    console.log(`Invite cancelled for ${inviteEmail} for project ${projectId}`);
    return { success: true };
  } catch (e: any) {
    console.error('Error cancelling project invite', e);
    return { success: false, error: e.message || 'Failed to cancel invite.' };
  }
};

// Add this function to get project details by ID
export const getProjectById = async (projectId: string): Promise<FullProjectData | null> => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (projectSnap.exists()) {
      const data = projectSnap.data();
      // Ensure members and pendingInvites are arrays even if undefined in Firestore
      const members = data.members || [];
      const pendingInvites = data.pendingInvites || [];

      return {
        id: projectSnap.id,
        name: data.name,
        createdAt: data.createdAt,
        creatorEmail: data.creatorEmail,
        members: members,
        pendingInvites: pendingInvites,
        sharedCalendarId: data.sharedCalendarId // Include the sharedCalendarId
      } as FullProjectData;
    } else {
      console.error('Project not found:', projectId);
      return null;
    }
  } catch (error) {
    console.error('Error fetching project by ID:', error);
    return null;
  }
};