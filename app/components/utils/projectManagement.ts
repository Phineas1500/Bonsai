import { db } from "@/firebaseConfig";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { getUserByEmail } from "./userManagement";

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
    const docRef = await addDoc(collection(db, "projects"), {
      // id automatically created
      createdAt: new Date(),
      creatorEmail: email,
      name: projectName,
      members: [
        { email: email, username: user.data().username },
      ],
      pendingInvites: []
    });
    console.log("New project ID:", docRef.id);
    return true;
  } catch (e) {
    console.error("Error creating project: ", e);
    return false;
  }
};

export const deleteProject = async () => {
  // delete directly from projects collection
  // check to make sure creator is deleting
};