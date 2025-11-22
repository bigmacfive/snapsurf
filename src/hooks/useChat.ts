// 채팅 상태 관리 Hook

import { useState } from 'react';
import { ChatMessage, ModelType } from '../types';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 브라우저 자동화를 도와드리겠습니다. 무엇을 도와드릴까요?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('auto');

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const addUserMessage = (content: string) => {
    addMessage({ role: 'user', content });
  };

  const addAssistantMessage = (content: string) => {
    addMessage({ role: 'assistant', content });
  };

  const clearInput = () => {
    setInput('');
  };

  return {
    messages,
    input,
    isLoading,
    selectedModel,
    setInput,
    setIsLoading,
    setSelectedModel,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    clearInput
  };
}
