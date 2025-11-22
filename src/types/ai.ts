// AI 관련 타입 정의

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ModelType = 'auto' | 'flash' | 'pro';

export interface ChatState {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  selectedModel: ModelType;
}
