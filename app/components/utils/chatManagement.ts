import { db, auth } from 'firebaseConfig';
import { doc, addDoc, collection, where, query, getDocs, getDoc, setDoc, orderBy, deleteDoc, limit } from 'firebase/firestore';
import { Message } from '@components/chat';

import { Content } from '@google/generative-ai';

/**
 * Creates a chat document in the database in the 'chats' collection
 *
 * @param email the email of the user who is creating the chat
 * @returns the id of the chat that was created
 */
export const createChat = async (email: string) => {
  try {
    //add the new chat to the "chats" collection
    const docRef = await addDoc(collection(db, "chats"), {
      createdAt: new Date(),
      lastUpdated: new Date(),
      createdBy: email,
      participants: [email], //maybe have more participants in the future
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating chat: ", error);
    return null;
  }
}

export const deleteChat = async (email: string) => {
  try {
    const q = query(collection(db, "chats"), where("createdBy", "==", email));
    const chatsCollection = await getDocs(q);
    if (!chatsCollection.empty) {
      chatsCollection.forEach(async (chat) => {
        await deleteDoc(doc(db, 'chats', chat.id))
          .then(() => {
            console.log('User chat has been deleted from firestore database');
          }).catch((error) => {
            console.error('Error:', error);
          });
      })
    }
  } catch (error) {
    console.error("Error deleting chat:", error);
  }
}

export const getChatById = async (chatId: string) => {
  try {
    const chatRef = doc(db, "chats", chatId);
    const chatDoc = await getDoc(chatRef);
    if (chatDoc.exists()) {
      console.log("Chat found:", chatDoc.data());
      return { id: chatDoc.id, ...chatDoc.data() };
    } else {
      console.log("Chat not found");
      return null;
    }
  } catch (error) {
    console.error("Error retrieving chat:", error);
    return null;
  }
}

export const getMessages = async (chatId: string) => {
  try {
    const messagesRef = collection(db, `chats/${chatId}/messages`);
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

export const getUserChats = async (userEmail: string) => {
  try {
    const q = query(collection(db, "chats"), where("createdBy", "==", userEmail));
    const chatsCollection = await getDocs(q);

    const chats = chatsCollection.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return chats;
  } catch (error) {
    console.error("Error fetching chats: ", error);
    return [];
  }
}

export const sendMessage = async (chatId: string, message: Message) => {
  try {
    const messagesRef = collection(db, `chats/${chatId}/messages`);

    //add the message to the 'messages' subcollection
    await addDoc(messagesRef, {
      text: message.text,
      sender: message.sender, //either user email or 'bot'
      senderUsername: message.senderUsername,
      timestamp: message.timestamp
    });

    //update the recently modified dates for the chat
    const chatRef = doc(db, `chats/${chatId}`);
    await setDoc(chatRef, {
      lastUpdated: new Date(),
    }, { merge: true });
  } catch (error) {
    console.error("Error sending message:", error);
  }
}


/**
 * Saves a chat summary to the database
 */
export const saveChatSummary = async (chatId: string, summary: string, lastMessageId?: string): Promise<void> => {
  try {
    console.log("\tSaving chat summary:", summary);
    const summaryRef = collection(db, `chats/${chatId}/summaries`);

    // if existing summary exists, update it; otherwise create a new one
    const existingQuery = query(summaryRef);
    const existingDocs = await getDocs(existingQuery);

    if (!existingDocs.empty) {
      const existingDoc = existingDocs.docs[0];
      await setDoc(doc(db, `chats/${chatId}/summaries`, existingDoc.id), {
        text: summary,
        timestamp: new Date(),
        lastMessageId: lastMessageId || null
      });
    } else {
      await addDoc(summaryRef, {
        text: summary,
        timestamp: new Date(),
        lastMessageId: lastMessageId || null
      });
    }
    console.log("ADDED SUMMARY TO FIRESTORE");
  } catch (error) {
    console.error("Error saving chat summary:", error);
  }
};

/**
 * Gets the latest chat summary from the database
 */
export const getChatSummary = async (chatId: string): Promise<{ text: string | null, lastMessageId: string | null }> => {
  try {
    const summaryRef = collection(db, `chats/${chatId}/summaries`);
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
    console.error("Error fetching chat summary:", error);
    return { text: null, lastMessageId: null };
  }
};


/**
 * FUNCTION TO GET most recent messages after a certain message id
 * @param pathPrefix - ('chats' or 'projects')
 * @param id - chat or project id
 * @param lastMessageId - doc id of last message that was summarized
 */
export const fetchMessagesWithFallback = async (
  pathPrefix: string,
  id: string,
  lastMessageId: string | null
): Promise<Message[]> => {
  const messagesRef = collection(db, `${pathPrefix}/${id}/messages`);

  // If we have a lastMessageId, try to fetch messages after that one
  if (lastMessageId) {
    try {
      const lastMessageDoc = await getDoc(doc(db, `${pathPrefix}/${id}/messages`, lastMessageId));

      if (lastMessageDoc.exists()) {
        const timestamp = lastMessageDoc.data().timestamp;

        const q = query(
          messagesRef,
          orderBy("timestamp", "asc"),
          where("timestamp", ">", timestamp)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            sender: data.sender,
            senderUsername: data.senderUsername,
            timestamp: data.timestamp,
          };
        });
      }
    } catch (error) {
      console.error(`ERROR - lastMessageId doc didnt exist: ${error}`);
    }
  }

  // Fallback: return the most recent messages
  const q = query(messagesRef, orderBy("timestamp", "desc"), limit(20));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      text: data.text,
      sender: data.sender,
      senderUsername: data.senderUsername,
      timestamp: data.timestamp,
    };
  }).reverse();
};


// Gets normal chat history + summary
export const getHistory = async (chatId: string) => {
  try {
    const summaryData = await getChatSummary(chatId);
    const summary = summaryData.text;

    const recentMessages = await fetchMessagesWithFallback('chats', chatId, summaryData.lastMessageId);

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
          text: message.text,
        }]
      });
    }

    return history;
  } catch (error) {
    console.error("Error getting history:", error);
    return [];
  }
};