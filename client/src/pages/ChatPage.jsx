import React from 'react';
import { ChatWidget } from '../components/ChatWidget';
import { Bot, Sparkles } from 'lucide-react';
import { Badge } from '../components/common/Badge';

export const ChatPage = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Badge variant="primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}>
            <Sparkles size={13} style={{ marginRight: '0.35rem' }} />
            EventSync AI Assistant
          </Badge>
          <Badge variant="info">English + Telugu (Tanglish)</Badge>
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '0.4rem', color: '#FFFFFF' }}>
          Ask EventSync Anything
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          Check your registered events, live capacity, attendance status, certificates, coordinators, or ask general questions!
        </p>
      </div>

      <ChatWidget defaultOpen={true} standalone={true} />
    </div>
  );
};
