import { db } from '@/firebaseConfig';
import { addDoc, collection, deleteDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
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

export const getAllProjectInvites = async (email: string) => {

};

export const acceptProjectInvite = async (projectId: string) => {

};

export const rejectProjectInvite = async (projectId: string) => {

};