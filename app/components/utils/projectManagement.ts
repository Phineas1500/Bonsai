import { auth, db } from '@/firebaseConfig';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { getUserByEmail } from './userManagement';

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
}

export const createProject = async (email: string, projectName: string) => {
  try {
    const user = await getUserByEmail(email);
    const docRef = await addDoc(collection(db, 'projects'), {
      // id automatically created
      createdAt: new Date(),
      creatorEmail: email,
      name: projectName,
      members: [
        { email: email, username: user.data().username },
      ],
      pendingInvites: []
    });
    console.log('New project ID:', docRef.id);
    return true;
  } catch (e) {
    console.error('Error creating project: ', e);
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

export const sendProjectInvite = async () => {
  // @RAM HERE
  // add invited user's email to pendingInvites for current project
  // currently searching for project invites by going through all projects and searching for user's email
};