import { useState, useEffect } from 'react';
import { doc, getDoc, getDocs, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getUsernameFromEmail } from './userManagement';
import { Message } from '@components/chat';

import { Content } from '@google/generative-ai';

// Type for project members with both email and username
export interface ProjectMember {
  email: string;
  username: string;
}

export interface ProjectMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Timestamp;
  senderUsername: string;
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: Timestamp;
  creatorEmail: string;
  members: ProjectMember[];
  pendingInvites: string[]; // Still just emails for pending
}


export function useProjectChat(projectId: string, currentUserEmail: string) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Format timestamp for display
  const formatMessageTime = (timestamp: Timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return new Date(date).toLocaleString();
  };

  // Fetch project details
  useEffect(() => {
    if (!projectId) return;

    const fetchProject = async () => {
      try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
          const rawData = projectSnap.data();
          console.log(rawData.members);

          setProject({
            id: projectSnap.id,
            name: rawData.name,
            createdAt: rawData.createdAt,
            creatorEmail: rawData.creatorEmail,
            members: rawData.members as ProjectMember[] || [],
            pendingInvites: rawData.pendingInvites || []
          });
        } else {
          console.error('Project not found');
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  // Subscribe to messages
  useEffect(() => {
    if (!projectId) return;

    const messagesRef = collection(db, 'projects', projectId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      // For more complex transformations requiring async operations
      const messagesPromises = snapshot.docs.map(async doc => {
        const data = doc.data();

        // Get username if not already included
        let senderUsername = data.senderUsername;
        if (!senderUsername) {
          senderUsername = await getUsernameFromEmail(data.sender);
        }

        return {
          id: doc.id,
          sender: data.sender,
          text: data.text,
          timestamp: data.timestamp,
          senderUsername
        };
      });

      const messagesList = await Promise.all(messagesPromises);
      setMessages(messagesList);
    });

    return () => unsubscribe();
  }, [projectId]);

  // Send a new message
  const handleSendMessage = async (chatId: string, messageObj?: ProjectMessage) => {
    try {
      setSendingMessage(true);
      const projectRef = doc(db, 'projects', projectId);
      const messagesRef = collection(projectRef, 'messages');

      // If messageObj is provided, use it - this is for AI-generated messages or predefined messages
      if (messageObj) {
        await addDoc(messagesRef, {
          sender: messageObj.sender,
          text: messageObj.text,
          senderUsername: messageObj.senderUsername || await getUsernameFromEmail(messageObj.sender),
          timestamp: messageObj.timestamp || serverTimestamp()
        });
        return;
      }

      // Otherwise use the newMessage state - this is for user input messages
      if (!newMessage.trim()) return;

      // Get username for current user
      const senderUsername = await getUsernameFromEmail(currentUserEmail);

      await addDoc(messagesRef, {
        sender: currentUserEmail,
        text: newMessage.trim(),
        senderUsername,
        timestamp: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Determine if a message is from the current user
  const isOwnMessage = (sender: string) => {
    return sender === currentUserEmail;
  };

  // Toggle member list visibility
  const toggleMembers = () => {
    setShowMembers(!showMembers);
  };

  // Find member by email
  const getMemberByEmail = (email: string) => {
    if (!project?.members) return null;
    return project.members.find(member => member.email === email);
  };

  return {
    project,
    messages,
    newMessage,
    setNewMessage,
    loading,
    showMembers,
    sendingMessage,
    formatMessageTime,
    handleSendMessage,
    getUsernameFromEmail,
    isOwnMessage,
    toggleMembers,
    getMemberByEmail,
    isCreator: project?.creatorEmail === currentUserEmail
  };
}

export const getProjectMessages = async (projectId: string) => {
  try {
    const messagesRef = collection(db, `projects/${projectId}/messages`);
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const snapshot = await getDocs(q);

    //return a list of message objects
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const currentMessage: Message = {
        id: doc.id,
        text: data.text,
        sender: data.sender,
        senderUsername: data.senderUsername,
        timestamp: data.timestamp,
      }
      return currentMessage;
    });

  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
};


export const getProjectHistory = async (projectId: string) => {
  try {
    let history = [] as Content[];

    const messagesHistory = await getProjectMessages(projectId);
    for (const message of messagesHistory) {
      history.push({
        "role": message.senderUsername === 'Bonsai' ? 'model' : 'user',
        "parts": [
          {
            "text": (message.senderUsername !== 'Bonsai' ? (message.senderUsername + ": ") : "") + message.text,
          }
        ]
      });
    }
    return history;
  } catch (error) {
    console.error("Error getting history:", error);
    return [];
  }
}