import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { getHistory } from '@components/utils/chatManagement';
import { getProjectHistory } from '@components/utils/projectChatManagement';

// Singleton class to manage AI chat sessions
class AIService {
  private static instance: AIService;
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private chatSessions: Map<string, ChatSession> = new Map();
  private initialized = false;

  private constructor() {}

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
      this.model = await this.genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25" });
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
    let history = [];
    if (isProjectChat) {
      history = await getProjectHistory(chatId);
    } else {
      history = await getHistory(chatId);
    }

    const chatSession = this.model.startChat({
      generationConfig,
      systemInstruction: {
        role: 'system',
        parts: [{text: systemMessage}],
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
