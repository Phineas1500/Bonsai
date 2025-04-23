import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { getHistory, getChatSummary, saveChatSummary, getMessages } from '@components/utils/chatManagement';
import { getProjectHistory, getProjectChatSummary, saveProjectChatSummary, getProjectMessages } from '@components/utils/projectChatManagement';

// Singleton class to manage AI chat sessions
class AIService {
  private static instance: AIService;
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private chatSessions: Map<string, ChatSession> = new Map();
  private initialized = false;

  private readonly MESSAGES_TO_TRIGGER_SUMMARY = 20;  // trigger at 20
  private readonly MESSAGES_TO_KEEP = 10;  // keep this many recent messages when summarizing

  private constructor() { }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not defined');
      }

      this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      this.model = await this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
      this.initialized = true;
    } catch (error) {
      console.error("Error initializing AI service:", error);
      throw error;
    }
  }

  public async startChat(sessionId: string, systemMessage: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const generationConfig = {
      temperature: 0.2,
      maxOutputTokens: 2048,
    };

    const chatId = sessionId.split('_')[1];
    const isProjectChat = sessionId.split('_')[0] === 'project';

    await this.checkAndUpdateSummary(chatId, isProjectChat);

    const history = isProjectChat
      ? await getProjectHistory(chatId)
      : await getHistory(chatId);

    console.log("history length:", history.length);

    const chatSession = this.model.startChat({
      generationConfig,
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemMessage }],
      },
      history: history,
    });

    this.chatSessions.set(sessionId, chatSession);
  }

  // checkAndUpdateSummary checks if we need to create or update the summary for a chat
  // steps:
  // 1. get the summary, if does not exist:
  //   - check if all messages >= 20 and create summary from 10 to end (should be 20)
  // 2. if summary exists:
  //   - get the last summarized message and see if there are at least 10 new messages since then
  //   - if so, summarize those and update the summary
  private async checkAndUpdateSummary(chatId: string, isProjectChat: boolean): Promise<void> {
    try {
      const summaryData = isProjectChat
        ? await getProjectChatSummary(chatId)
        : await getChatSummary(chatId);

      // if no summary
      if (!summaryData.lastMessageId && !summaryData.text) {
        const allMessages = isProjectChat
          ? await getProjectMessages(chatId)
          : await getMessages(chatId);

        // if enough messages
        if (allMessages.length >= this.MESSAGES_TO_TRIGGER_SUMMARY) {
          // (messages are ascending, so oldest first, take all but the last 10)
          const messagesToSummarize = allMessages.slice(0, allMessages.length - this.MESSAGES_TO_KEEP);

          // add senderusername if project chat
          const formattedMessages = messagesToSummarize.map(msg => ({
            role: msg.senderUsername === 'Bonsai' ? 'model' : 'user',
            parts: [{
              text: isProjectChat ? (msg.senderUsername !== 'Bonsai' ? (msg.senderUsername + ": ") : "") : "" + msg.text,
            }]
          }));

          const summary = await this.summarizeMessages(formattedMessages);
          const lastMessageId = messagesToSummarize[messagesToSummarize.length - 1].id;

          if (isProjectChat) {
            await saveProjectChatSummary(chatId, summary, lastMessageId);
          } else {
            await saveChatSummary(chatId, summary, lastMessageId);
          }
        }

        return;
      }

      // SUMMARY EXISTS, check if we need to update it
      const allMessages = isProjectChat
        ? await getProjectMessages(chatId)
        : await getMessages(chatId);

      if (summaryData.lastMessageId) {
        // Find the index of the last summarized message
        const lastSummarizedIndex = allMessages.findIndex(msg => msg.id === summaryData.lastMessageId);
        // console.log("Last summarized message index:", lastSummarizedIndex);
        // console.log("Total messages in history:", allMessages.length);

        if (lastSummarizedIndex === -1) {
          console.log("Last summarized message not found in history -- something went wrong....");
          return;
        }

        const newMessagesCount = allMessages.length - (lastSummarizedIndex + 1);
        console.log("new messages since last summary:", newMessagesCount);

        // if enough new messages (20)
        if (newMessagesCount >= this.MESSAGES_TO_TRIGGER_SUMMARY) {
          // console.log("AIService - SUMMARIZING");

          // Get messages to add to the summary (between last summarized and the cutoff: 10)
          const cutoffIndex = allMessages.length - this.MESSAGES_TO_KEEP;
          const messagesToAdd = allMessages.slice(lastSummarizedIndex + 1, cutoffIndex);
          // console.log("ADDING FROM index:", lastSummarizedIndex + 1, "to index:", cutoffIndex);

          if (messagesToAdd.length === 0) return;

          // same as above
          const formattedMessages = messagesToAdd.map(msg => ({
            role: msg.senderUsername === 'Bonsai' ? 'model' : 'user',
            parts: [{
              text: isProjectChat ? (msg.senderUsername !== 'Bonsai' ? (msg.senderUsername + ": ") : "") : "" + msg.text,
            }]
          }));

          const existingSummary = {
            role: 'user',
            parts: [{
              text: `[CONVERSATION SUMMARY: ${summaryData.text}]`
            }]
          };

          const newSummary = await this.summarizeMessages([existingSummary, ...formattedMessages]);
          const newLastMessageId = messagesToAdd[messagesToAdd.length - 1].id;

          if (isProjectChat) {
            await saveProjectChatSummary(chatId, newSummary, newLastMessageId);
          } else {
            await saveChatSummary(chatId, newSummary, newLastMessageId);
          }
        }
      }
    } catch (error) {
      console.error("Error in checkAndUpdateSummary:", error);
    }
  }

  public async sendMessage(sessionId: string, message: string): Promise<any> {
    const chatSession = this.chatSessions.get(sessionId);

    if (!chatSession) {
      throw new Error(`Chat session with ID ${sessionId} not initialized`);
    }

    const result = await chatSession.sendMessage(message);

    // check if we need to update the summary in the background
    const chatId = sessionId.split('_')[1];
    const isProjectChat = sessionId.split('_')[0] === 'project';

    this.checkAndUpdateSummary(chatId, isProjectChat).catch(err => {
      console.error("Background summary update failed:", err);
    });

    return result.response.text();
  }

  private async summarizeMessages(messages: any[]): Promise<string> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    if (messages.length === 0) return "No previous conversation.";

    try {
      const summarizationChat = this.model.startChat({
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
        },
        systemInstruction: {
          role: 'system',
          parts: [{
            text: `You are a summarization assistant. Your task is to create a concise summary of
            the conversation history provided below. Focus on key points, decisions made,
            any actions that were agreed upon, and important context. Keep the summary brief but
            informative so someone reading it would understand the main topics discussed.`
          }]
        },
      });

      // Check if the first message is a summary and extract it
      let existingSummary = "";
      if (messages.length > 0 &&
        messages[0].role === 'user' &&
        messages[0].parts[0].text.includes('[CONVERSATION SUMMARY:')) {
        const summaryText = messages[0].parts[0].text;
        existingSummary = summaryText.substring(
          summaryText.indexOf('[CONVERSATION SUMMARY:') + '[CONVERSATION SUMMARY:'.length,
          summaryText.indexOf(']', summaryText.indexOf('[CONVERSATION SUMMARY:'))
        ).trim();

        // Skip the summary when creating the conversation text
        messages = messages.slice(1);
      }

      let conversationText = messages.map(msg => {
        const role = msg.role === 'model' ? 'AI' : 'User';
        return `${role}: ${msg.parts[0].text}`;
      }).join("\n\n");

      // Include existing summary in the input if available
      const promptText = existingSummary
        ? `Previous summary: ${existingSummary}\n\nAdditional conversation to incorporate:\n\n${conversationText}\n\nProvide an updated comprehensive summary that includes both the previous summary and the new conversation.`
        : `Please summarize the following conversation:\n\n${conversationText}\n\nProvide a concise summary that captures the key points.`;

      const result = await summarizationChat.sendMessage(promptText);
      return result.response.text().trim();
    } catch (error) {
      console.error("Error summarizing messages:", error);
      return "Previous conversation summary unavailable.";
    }
  }

  public resetChat(sessionId?: string): void {
    if (sessionId) {
      // Reset specific chat session
      this.chatSessions.delete(sessionId);
    } else {
      // Reset all chat sessions
      this.chatSessions.clear();
    }
  }

  public isSessionActive(sessionId: string): boolean {
    return this.chatSessions.has(sessionId);
  }

  public getActiveSessions(): string[] {
    return Array.from(this.chatSessions.keys());
  }
}

export default AIService;
