import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { getHistory, getChatSummary, saveChatSummary } from '@components/utils/chatManagement';
import { getProjectHistory, getProjectChatSummary, saveProjectChatSummary } from '@components/utils/projectChatManagement';

// Singleton class to manage AI chat sessions
class AIService {
  private static instance: AIService;
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private chatSessions: Map<string, ChatSession> = new Map();
  private initialized = false;

  private readonly RECENT_MESSAGES_TO_KEEP = 10;
  private readonly SUMMARIZE_THRESHOLD = 20;

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

    // this part basically just gets the chat history, and if too long
    // summarize all messages excluding most recent 10
    // Then, save it to firebase under summaries collection.
    const history = isProjectChat
      ? await getProjectHistory(chatId)
      : await getHistory(chatId);

    if (history && history.length >= this.SUMMARIZE_THRESHOLD) {
      // summarize the 0 to N-10 messages
      const messagesToSummarize = history.slice(0, history.length - this.RECENT_MESSAGES_TO_KEEP);
      const summary = await this.summarizeMessages(messagesToSummarize);

      if (isProjectChat) {
        await saveProjectChatSummary(chatId, summary);
      } else {
        await saveChatSummary(chatId, summary);
      }
    }

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

  public async sendMessage(sessionId: string, message: string): Promise<any> {
    const chatSession = this.chatSessions.get(sessionId);

    if (!chatSession) {
      throw new Error(`Chat session with ID ${sessionId} not initialized`);
    }

    const result = await chatSession.sendMessage(message);
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
          maxOutputTokens: 512,
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

      // Extract the summary if it's the first message and contains summary content
      let existingSummary = "";
      if (messages.length > 0 &&
        messages[0].role === 'model' &&
        messages[0].parts[0].text.includes('[CONVERSATION SUMMARY:')) {
        const summaryText = messages[0].parts[0].text;
        existingSummary = summaryText.substring(
          summaryText.indexOf('[CONVERSATION SUMMARY:') + '[CONVERSATION SUMMARY:'.length,
          summaryText.indexOf(']', summaryText.indexOf('[CONVERSATION SUMMARY:'))
        );

        // Remove the summary message from the array for conversion
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
      return result.response.text();
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
