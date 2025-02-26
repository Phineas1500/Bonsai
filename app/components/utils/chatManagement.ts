import { db } from 'firebaseConfig';
import { doc, addDoc, serverTimestamp, collection, where, query, getDocs, getDoc, setDoc, orderBy } from 'firebase/firestore';
import { Message } from '@/app/screens/chat';

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
                timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(), //ensure valid Date object 
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
            timestamp: message.timestamp
        });
        
        //update the recently modified dates for the chat
        const chatRef = doc(db, `chats/${chatId}`);
        await setDoc(chatRef, {
            lastUpdated: new Date(),
        }, {merge: true});
    } catch (error) {
        console.error("Error sending message:", error);
    }
}