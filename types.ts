export enum ConversationState {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  LISTENING = "LISTENING",
  PROCESSING = "PROCESSING",
  SPEAKING = "SPEAKING",
  TYPING = "TYPING", // For text response generation
  ERROR = "ERROR",
}

export interface GroundingSource {
    uri: string;
    title: string;
}

export interface UploadedFile {
    name: string;
    // We don't store the content in the transcript, just the name for display.
}

export interface TranscriptEntry {
  source: 'user' | 'gemini';
  text: string;
  isTyping?: boolean;
  imageUrl?: string;
  sources?: GroundingSource[];
  files?: UploadedFile[];
}

export type Theme = 'light' | 'dark';
export type Voice = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
export type TextModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';
export type ChatMode = 'default' | 'search' | 'image' | 'reasoning';


export interface Settings {
    systemPrompt: string;
    voice: Voice;
    textModel: TextModel;
    theme: Theme;
    sendOnEnter: boolean;
}