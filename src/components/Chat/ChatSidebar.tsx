import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../../types/ai';

interface ChatSidebarProps {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  selectedModel: 'auto' | 'flash' | 'pro';
  onInputChange: (value: string) => void;
  onSend: () => void;
  onModelChange: (model: 'auto' | 'flash' | 'pro') => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  messages,
  input,
  isLoading,
  selectedModel,
  onInputChange,
  onSend,
  onModelChange
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      onSend();
    }
  };

  return (
    <div className="chat-sidebar">
      <div className="chat-header">
        <h3>Gemini AI</h3>
        <select
          className="model-selector"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value as 'auto' | 'flash' | 'pro')}
          disabled={isLoading}
        >
          <option value="auto">Auto</option>
          <option value="flash">Flash</option>
          <option value="pro">Pro (Computer Use)</option>
        </select>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-content">생각 중...</div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="메시지를 입력하세요..."
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          onClick={onSend}
          disabled={isLoading || !input.trim()}
        >
          전송
        </button>
      </div>
    </div>
  );
};
