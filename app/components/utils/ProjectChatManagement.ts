import { useState, useEffect } from 'react';
import { doc, getDoc, getDocs, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, limit, setDoc, where } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getUsernameFromEmail } from './userManagement';
import { Message } from '@components/chat';

import { Content } from '@google/generative-ai';
import { fetchMessagesWithFallback } from './chatManagement';

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
  sharedCalendarId?: string; // Optional: ID of the shared Google Calendar
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

/**
 * Saves a project chat summary to the database
 */
export const saveProjectChatSummary = async (projectId: string, summary: string, lastMessageId?: string): Promise<void> => {
  try {
    console.log("\tsaving project summary...");
    const summaryRef = collection(db, `projects/${projectId}/summaries`);

    // if existing summary exists, update it; otherwise create a new one
    const existingQuery = query(summaryRef);
    const existingDocs = await getDocs(existingQuery);

    if (!existingDocs.empty) {
      const existingDoc = existingDocs.docs[0];
      await setDoc(doc(db, `projects/${projectId}/summaries`, existingDoc.id), {
        text: summary,
        timestamp: new Date(),
        lastMessageId: lastMessageId || null
      });
      console.log("\tupdated existing project summary");
    } else {
      await addDoc(summaryRef, {
        text: summary,
        timestamp: new Date(),
        lastMessageId: lastMessageId || null
      });
      console.log("\tcreated new project summary");
    }
  } catch (error) {
    console.error("Error saving project chat summary:", error);
  }
};

/**
 * Gets the latest project chat summary from the database
 */
export const getProjectChatSummary = async (projectId: string): Promise<{ text: string | null, lastMessageId: string | null }> => {
  try {
    const summaryRef = collection(db, `projects/${projectId}/summaries`);
    const q = query(summaryRef, orderBy("timestamp", "desc"), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { text: null, lastMessageId: null };
    }

    const data = snapshot.docs[0].data();
    return {
      text: data.text || null,
      lastMessageId: data.lastMessageId || null
    };
  } catch (error) {
    console.error("Error fetching project chat summary:", error);
    return { text: null, lastMessageId: null };
  }
};


// Gets project chat history + summary
export const getProjectHistory = async (projectId: string) => {
  try {
    const summaryData = await getProjectChatSummary(projectId);
    const summary = summaryData.text;

    const recentMessages = await fetchMessagesWithFallback('projects', projectId, summaryData.lastMessageId);

    let history: Content[] = [];

    if (summary) {
      history.push({
        role: 'user',
        parts: [{
          text: `[CONVERSATION SUMMARY: ${summary}]`
        }]
      });
    }

    for (const message of recentMessages) {
      history.push({
        role: message.senderUsername === 'Bonsai' ? 'model' : 'user',
        parts: [{
          text: (message.senderUsername !== 'Bonsai' ? (message.senderUsername + ": ") : "") + message.text,
        }]
      });
    }

    return history;
  } catch (error) {
    console.error("Error getting project history:", error);
    return [];
  }
};