import { useState, useEffect } from 'react';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getUserByEmail } from './userManagement';

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
  members: ProjectMember[]; // Now using ProjectMember type
  pendingInvites: string[]; // Still just emails for pending
}

// Cache for usernames to avoid repeated lookups
const usernameCache = new Map<string, string>();

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

  // Helper function to get username from email
  const getUsernameFromEmail = async (email: string): Promise<string> => {
    // Check cache first
    if (usernameCache.has(email)) {
      return usernameCache.get(email) as string;
    }

    // For bot messages
    if (email === 'bot') return 'Bonsai';

    try {
      const userDoc = await getUserByEmail(email);
      if (userDoc) {
        const username = userDoc.data().username;
        // Cache for future use
        usernameCache.set(email, username);
        return username;
      }
      return "";
    } catch (error) {
      console.error('Error getting username for email:', error);
      return "";
    }
  };

  // Fetch project details - handle conversion from old format to new
  useEffect(() => {
    if (!projectId) return;

    const fetchProject = async () => {
      try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
          const rawData = projectSnap.data();

          // Convert members to include usernames if they're in old format (just emails)
          let membersWithUsernames: ProjectMember[] = [];

          if (Array.isArray(rawData.members)) {
            // If stored as simple array of emails, convert to new format
            const memberEmails = rawData.members as string[];

            // Get usernames for all members
            const memberPromises = memberEmails.map(async (email) => {
              const username = await getUsernameFromEmail(email);
              return { email, username };
            });

            membersWithUsernames = await Promise.all(memberPromises);
          } else if (rawData.members && typeof rawData.members === 'object') {
            // If already in new format, use as is
            membersWithUsernames = rawData.members;
          }

          setProject({
            id: projectSnap.id,
            name: rawData.name,
            createdAt: rawData.createdAt,
            creatorEmail: rawData.creatorEmail,
            members: membersWithUsernames,
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
