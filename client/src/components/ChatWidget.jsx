import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Sparkles,
  Bot,
  User,
  Loader2,
  ChevronDown,
  Minimize2,
  Maximize2,
  HelpCircle,
} from 'lucide-react';
import { sendChatMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { InventionCard } from './InventionCard';
import { Button } from './common/Button';
import { Badge } from './common/Badge';

const STUDENT_SUGGESTIONS = [
  'My registered events',
  'Registration deadlines',
  'My attendance status',
  'Certificate status',
  'Who created EventSync?',
];

const ADMIN_SUGGESTIONS = [
  'Total event registrations',
  'How many teams registered?',
  'Attendance summary',
  'Certificate status overview',
  'Who created EventSync?',
];

const INITIAL_WELCOME = {
  id: 'welcome-msg',
  role: 'assistant',
  type: 'text',
  message:
    'Namaste! Nenu **EventSync Assistant** 🤖\n\nCollege events, registrations, attendance, certificates, deadlines, or platform details gurinchi nannu adagochu.\n\nEla help cheyagalanu?',
  timestamp: new Date(),
};

/**
 * Lightweight Markdown text renderer for bold, lists, code, and links.
 */
const FormattedMessageText = ({ text }) => {
  if (!text) return null;

  // Split lines
  const lines = text.split('\n');

  return (
    <div className="chat-markdown-content" style={{ fontSize: '0.9rem', lineHeight: 1.55 }}>
      {lines.map((line, lineIdx) => {
        // Bullet point
        const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
        const isNumbered = /^\d+\.\s/.test(line.trim());

        // Process inline markdown (**bold**, `code`, [link](url))
        const renderInline = (str) => {
          const parts = [];
          // Tokenize bold, code, links
          const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
          let lastIndex = 0;
          let match;

          while ((match = regex.exec(str)) !== null) {
            if (match.index > lastIndex) {
              parts.push(str.substring(lastIndex, match.index));
            }
            const token = match[0];
            if (token.startsWith('**') && token.endsWith('**')) {
              parts.push(
                <strong key={`b-${match.index}`} style={{ color: '#F8FAFC' }}>
                  {token.slice(2, -2)}
                </strong>
              );
            } else if (token.startsWith('`') && token.endsWith('`')) {
              parts.push(
                <code
                  key={`c-${match.index}`}
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '0.15rem 0.35rem',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    color: '#A5B4FC',
                  }}
                >
                  {token.slice(1, -1)}
                </code>
              );
            } else if (token.startsWith('[') && token.includes('](')) {
              const linkMatch = token.match(/\[(.*?)\]\((.*?)\)/);
              if (linkMatch) {
                parts.push(
                  <a
                    key={`a-${match.index}`}
                    href={linkMatch[2]}
                    target={linkMatch[2].startsWith('tel:') ? '_self' : '_blank'}
                    rel="noreferrer"
                    style={{ color: '#818CF8', textDecoration: 'underline', fontWeight: '600' }}
                  >
                    {linkMatch[1]}
                  </a>
                );
              }
            }
            lastIndex = regex.lastIndex;
          }

          if (lastIndex < str.length) {
            parts.push(str.substring(lastIndex));
          }

          return parts.length > 0 ? parts : str;
        };

        if (isBullet) {
          return (
            <div
              key={lineIdx}
              style={{
                display: 'flex',
                gap: '0.45rem',
                alignItems: 'flex-start',
                marginLeft: '0.4rem',
                marginTop: '0.2rem',
              }}
            >
              <span style={{ color: '#818CF8', lineHeight: 1.2 }}>•</span>
              <div style={{ flex: 1 }}>{renderInline(line.replace(/^[-*]\s*/, ''))}</div>
            </div>
          );
        }

        if (isNumbered) {
          const numMatch = line.match(/^(\d+\.)\s*(.*)$/);
          return (
            <div
              key={lineIdx}
              style={{
                display: 'flex',
                gap: '0.45rem',
                alignItems: 'flex-start',
                marginLeft: '0.4rem',
                marginTop: '0.2rem',
              }}
            >
              <span style={{ color: '#F59E0B', fontWeight: '600', fontSize: '0.85rem' }}>{numMatch[1]}</span>
              <div style={{ flex: 1 }}>{renderInline(numMatch[2])}</div>
            </div>
          );
        }

        if (line.trim() === '') {
          return <div key={lineIdx} style={{ height: '0.45rem' }} />;
        }

        return <div key={lineIdx}>{renderInline(line)}</div>;
      })}
    </div>
  );
};

export const ChatWidget = ({ defaultOpen = false, standalone = false }) => {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([INITIAL_WELCOME]);
  const [loading, setLoading] = useState(false);

  const quickSuggestions = user?.role === 'EVENTADMIN' ? ADMIN_SUGGESTIONS : STUDENT_SUGGESTIONS;

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Auto-focus input when opened
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, loading]);

  const handleSend = async (messageToSend = null) => {
    const rawText = messageToSend !== null ? messageToSend : inputMessage;
    const trimmed = String(rawText || '').trim();
    if (!trimmed || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      type: 'text',
      message: trimmed,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setLoading(true);

    try {
      // Build context history (only latest 10 messages)
      const historyContext = newMessages.slice(-10).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.type === 'invention_card' ? JSON.stringify(m) : m.message,
      }));

      const res = await sendChatMessage({
        message: trimmed,
        history: historyContext,
      });

      if (res && res.success && res.data) {
        const botResponse = res.data;
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            role: 'assistant',
            type: botResponse.type || 'text',
            message: botResponse.message || '',
            ...botResponse,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            role: 'assistant',
            type: 'text',
            message:
              res?.message ||
              'Kshaminchandi, message deliver kaledu. Please try asking again in a moment.',
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          type: 'text',
          message:
            'Network issue vachindi. Please ensure backend server is running and try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        ...INITIAL_WELCOME,
        id: `welcome-${Date.now()}`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSuggestionClick = (suggestion) => {
    handleSend(suggestion);
  };

  // If in standalone page mode (/chat)
  if (standalone) {
    return (
      <div
        className="chat-standalone-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 120px)',
          maxWidth: '900px',
          margin: '0 auto',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '1.25rem',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--gradient-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 0 16px rgba(99, 102, 241, 0.5)',
              }}
            >
              <Bot size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, color: '#FFFFFF' }}>
                  EventSync Assistant
                </h2>
                <Badge variant="success" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                  Online
                </Badge>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#A5B4FC' }}>
                AI Student Chatbot • English + Telugu (Tanglish)
              </span>
            </div>
          </div>

          <button
            onClick={handleClearChat}
            className="btn btn-secondary"
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title="Reset conversation"
          >
            <Trash2 size={14} />
            <span>Clear Chat</span>
          </button>
        </div>

        {/* Message Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: m.role === 'user' ? '75%' : '88%',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: m.role === 'user' ? 'linear-gradient(135deg, #EC4899, #8B5CF6)' : 'var(--gradient-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0,
                  fontSize: '0.8rem',
                }}
              >
                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div
                style={{
                  padding: '0.85rem 1.15rem',
                  borderRadius: '1rem',
                  borderTopRightRadius: m.role === 'user' ? '0.2rem' : '1rem',
                  borderTopLeftRadius: m.role === 'user' ? '1rem' : '0.2rem',
                  background:
                    m.role === 'user'
                      ? 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)'
                      : 'rgba(30, 41, 59, 0.85)',
                  border: '1px solid',
                  borderColor:
                    m.role === 'user' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                  color: '#F8FAFC',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                }}
              >
                {m.type === 'invention_card' ? (
                  <InventionCard card={m} />
                ) : (
                  <FormattedMessageText text={m.message} />
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', alignSelf: 'flex-start' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--gradient-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <Bot size={16} />
              </div>
              <div
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: '1rem',
                  background: 'rgba(30, 41, 59, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#A5B4FC',
                  fontSize: '0.85rem',
                }}
              >
                <Loader2 size={15} className="animate-spin" />
                <span>EventSync Assistant is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div
          style={{
            padding: '0.6rem 1.5rem',
            background: 'rgba(15, 23, 42, 0.5)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {quickSuggestions.map((chip, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSuggestionClick(chip)}
              style={{
                whiteSpace: 'nowrap',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#C7D2FE',
                fontSize: '0.78rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)')}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'rgba(15, 23, 42, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask about events, attendance, certificates or general questions..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="form-input"
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(30, 41, 59, 0.6)',
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputMessage.trim() || loading}
            className="btn btn-primary"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title="Send Message"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    );
  }

  // Floating Chat Widget Mode
  return (
    <>
      {/* Floating Trigger Button (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chat-floating-trigger"
          aria-label="EventSync AI Assistant"
          title="EventSync AI Assistant"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
            color: '#FFFFFF',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.5), 0 0 16px rgba(168, 85, 247, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(99, 102, 241, 0.65), 0 0 20px rgba(168, 85, 247, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.5), 0 0 16px rgba(168, 85, 247, 0.4)';
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={28} />
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#10B981',
                border: '2px solid #0F172A',
                boxShadow: '0 0 8px #10B981',
              }}
            />
          </div>
        </button>
      )}

      {/* Floating Chat Modal Window */}
      {isOpen && (
        <div
          className="chat-floating-window"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: isExpanded ? 'min(90vw, 700px)' : 'min(92vw, 420px)',
            height: isExpanded ? 'min(85vh, 750px)' : 'min(80vh, 580px)',
            borderRadius: '1.25rem',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5), 0 0 24px rgba(99, 102, 241, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 99999,
            overflow: 'hidden',
            animation: 'fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.85rem 1.15rem',
              background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.2) 100%)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'var(--gradient-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
                }}
              >
                <Bot size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: '#FFFFFF' }}>
                    EventSync Assistant
                  </h3>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10B981',
                      boxShadow: '0 0 8px #10B981',
                    }}
                    title="Active"
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#A5B4FC' }}>
                  Tanglish AI Assistant
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                onClick={handleClearChat}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  borderRadius: '0.35rem',
                }}
                title="Clear conversation"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setIsExpanded((prev) => !prev)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  borderRadius: '0.35rem',
                }}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  borderRadius: '0.35rem',
                }}
                title="Close chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Message List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: m.role === 'user' ? '82%' : '90%',
                  flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: m.role === 'user' ? 'linear-gradient(135deg, #EC4899, #8B5CF6)' : 'var(--gradient-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0,
                    fontSize: '0.75rem',
                  }}
                >
                  {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>

                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '0.9rem',
                    borderTopRightRadius: m.role === 'user' ? '0.2rem' : '0.9rem',
                    borderTopLeftRadius: m.role === 'user' ? '0.9rem' : '0.2rem',
                    background:
                      m.role === 'user'
                        ? 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)'
                        : 'rgba(30, 41, 59, 0.85)',
                    border: '1px solid',
                    borderColor:
                      m.role === 'user' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                    color: '#F8FAFC',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
                  }}
                >
                  {m.type === 'invention_card' ? (
                    <InventionCard card={m} />
                  ) : (
                    <FormattedMessageText text={m.message} />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', alignSelf: 'flex-start' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--gradient-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                  }}
                >
                  <Bot size={14} />
                </div>
                <div
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '0.85rem',
                    background: 'rgba(30, 41, 59, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    color: '#A5B4FC',
                    fontSize: '0.8rem',
                  }}
                >
                  <Loader2 size={13} className="animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          <div
            style={{
              padding: '0.45rem 0.85rem',
              background: 'rgba(15, 23, 42, 0.6)',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {quickSuggestions.map((chip, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSuggestionClick(chip)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                  color: '#C7D2FE',
                  fontSize: '0.74rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)')}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              background: 'rgba(15, 23, 42, 0.95)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask anything in English or Tanglish..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="form-input"
              style={{
                flex: 1,
                padding: '0.55rem 0.85rem',
                fontSize: '0.86rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(30, 41, 59, 0.6)',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputMessage.trim() || loading}
              className="btn btn-primary"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              title="Send Message"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
