// 채팅 메시지 컴포넌트

import { useEffect, useRef } from 'react';
import { ChatMessage } from '../../types';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
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
  );
}
