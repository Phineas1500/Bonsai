import { useState, useEffect } from 'react';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

export interface ProjectMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Timestamp;
  senderName?: string;
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: Timestamp;
  creatorEmail: string;
  members: string[];
  pendingInvites: string[];
}

export function useProjectChat(projectId: string | undefined, currentUserEmail: string) {
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
          const projectData = projectSnap.data() as Omit<ProjectData, 'id'>;
          setProject({
            id: projectSnap.id,
            ...projectData
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

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesList: ProjectMessage[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          sender: data.sender,
          text: data.text,
          timestamp: data.timestamp,
        };
      });

      setMessages(messagesList);
    });

    return () => unsubscribe();
  }, [projectId]);

  // Send a new message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !projectId || !currentUserEmail) return;

    setSendingMessage(true);
    try {
      const messagesRef = collection(db, 'projects', projectId, 'messages');
      await addDoc(messagesRef, {
        sender: currentUserEmail,
        text: newMessage.trim(),
        timestamp: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Get sender initials for avatar
  const getSenderInitials = (email: string) => {
    if (!email) return '?';
    const parts = email.split('@')[0].split('.');
    return parts.map(part => part[0]?.toUpperCase() || '').join('');
  };

  // Determine if a message is from the current user
  const isOwnMessage = (sender: string) => {
    return sender === currentUserEmail;
  };

  // Toggle member list visibility
  const toggleMembers = () => {
    setShowMembers(!showMembers);
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
    getSenderInitials,
    isOwnMessage,
    toggleMembers,
    isCreator: project?.creatorEmail === currentUserEmail
  };
}
