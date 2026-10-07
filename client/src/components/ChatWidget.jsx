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
  Minimize2,
  Maximize2,
  AlertCircle,
  RefreshCw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Languages,
  QrCode,
  MapPin,
  Calendar,
  ExternalLink,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { sendChatMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { InventionCard } from './InventionCard';
import { ChatRegistrationQRCard } from './ChatRegistrationQRCard';
import { ChatImageGallery } from './ChatImageGallery';
import { Badge } from './common/Badge';

const STUDENT_GENERAL_SUGGESTIONS = [
  { label: 'Gandhiji image chupinchu', icon: Sparkles },
  { label: 'Show Eiffel Tower', icon: MapPin },
  { label: 'Show QR for Dumb Charades', icon: QrCode },
  { label: 'Show me APJ Abdul Kalam', icon: Sparkles },
  { label: 'What events are available?', icon: Calendar },
  { label: 'Who created EventSync?', icon: HelpCircle },
];

const ADMIN_GENERAL_SUGGESTIONS = [
  { label: 'Gandhiji image chupinchu', icon: Sparkles },
  { label: 'Total event registrations', icon: Calendar },
  { label: 'Show QR for Dumb Charades', icon: QrCode },
  { label: 'Attendance summary', icon: ExternalLink },
  { label: 'Show me APJ Abdul Kalam', icon: Sparkles },
  { label: 'Who created EventSync?', icon: HelpCircle },
];

const getEventContextSuggestions = (eventTitle) => [
  { label: 'Show registration QR', icon: QrCode },
  { label: 'What is the venue?', icon: MapPin },
  { label: 'When is this event?', icon: Calendar },
  { label: 'Who is the coordinator?', icon: User },
  { label: 'Is there a registration fee?', icon: HelpCircle },
  { label: 'How do I register?', icon: ExternalLink },
];

const INITIAL_WELCOME = {
  id: 'welcome-msg',
  role: 'assistant',
  type: 'text',
  message:
    'Namaste! Welcome to **EventSync AI Assistant** 🤖\n\nI am your campus guide and multimodal assistant. You can ask me:\n- 🖼️ **Image Search**: Ask to see anything! *"Gandhiji image chupinchu"*, *"Show me APJ Abdul Kalam"*, *"Virat Kohli photo"*, *"Show Eiffel Tower"*, *"Cat picture"*, or *"Show a Ferrari"*.\n- 📱 **Registration QR**: Say *"Show registration QR"* or *"QR code chupinchu"* to get official registration passes.\n- 🎯 **EventSync queries**: Schedules, venues, attendance, and live registrations.\n- 💡 **General AI**: Programming, math, science, and questions in English and Telugu (Tanglish).\n\nEla help cheyagalanu?',
  timestamp: new Date(),
};

/**
 * Markdown text renderer supporting bold, inline code, code blocks, lists, and links.
 */
const FormattedMessageText = ({ text }) => {
  if (!text) return null;

  const rawParts = text.split(/(```[\s\S]*?```)/g);

  const renderInline = (str) => {
    const parts = [];
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
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '0.15rem 0.35rem',
              borderRadius: '4px',
              fontFamily: 'Consolas, Monaco, monospace',
              color: '#A5B4FC',
              fontSize: '0.85em',
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

  return (
    <div className="chat-markdown-content" style={{ fontSize: '0.9rem', lineHeight: 1.55 }}>
      {rawParts.map((part, partIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = firstLine && !firstLine.includes(' ') && firstLine.length < 15;
          const lang = hasLang ? firstLine : '';
          const codeContent = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div
              key={`code-${partIdx}`}
              style={{
                margin: '0.6rem 0',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                background: '#0B1120',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              {lang && (
                <div
                  style={{
                    padding: '0.3rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.72rem',
                    color: '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: '600',
                  }}
                >
                  {lang}
                </div>
              )}
              <pre
                style={{
                  margin: 0,
                  padding: '0.75rem 1rem',
                  overflowX: 'auto',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.82rem',
                  lineHeight: '1.45',
                  color: '#E2E8F0',
                }}
              >
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }

        const lines = part.split('\n');
        return lines.map((line, lineIdx) => {
          const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
          const isNumbered = /^\d+\.\s/.test(line.trim());

          if (isBullet) {
            return (
              <div
                key={`line-${partIdx}-${lineIdx}`}
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
                key={`line-${partIdx}-${lineIdx}`}
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
            return <div key={`line-${partIdx}-${lineIdx}`} style={{ height: '0.45rem' }} />;
          }

          return <div key={`line-${partIdx}-${lineIdx}`}>{renderInline(line)}</div>;
        });
      })}
    </div>
  );
};

export const ChatWidget = ({
  defaultOpen = false,
  standalone = false,
  eventId = null,
  eventContext = null,
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState([INITIAL_WELCOME]);
  const [loading, setLoading] = useState(false);
  const [activeEventId, setActiveEventId] = useState(eventId || eventContext?._id || null);
  const [voiceLanguage, setVoiceLanguage] = useState('en-IN'); // 'en-IN' or 'te-IN'
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'error'
  const [voiceError, setVoiceError] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  // Bulletproof lifecycle references for speech recognition
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const submittedRef = useRef(false);
  const sessionIdRef = useRef(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync active event ID from props
  useEffect(() => {
    if (eventId) {
      setActiveEventId(eventId);
    } else if (eventContext?._id) {
      setActiveEventId(eventContext._id);
    }
  }, [eventId, eventContext]);

  // Cleanup SpeechRecognition and TTS on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen || standalone) {
      scrollToBottom();
    }
  }, [isOpen, messages, loading, interimTranscript]);

  useEffect(() => {
    if (isOpen || standalone) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, standalone]);

  /**
   * Main Send Message Handler
   */
  const handleSend = async (messageToSend = null, targetEventId = null) => {
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
    setInterimTranscript('');
    setLoading(true);

    try {
      // Build context history (only latest 10 messages)
      const historyContext = newMessages.slice(-10).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        eventId: m.eventId,
        eventTitle: m.eventTitle,
        content:
          m.type === 'image_search'
            ? `[Images displayed for: ${m.query || 'search'}]`
            : m.type === 'registration_qr'
            ? `[Official Event Registration QR Code for ${m.eventTitle || 'Event'}]`
            : m.type === 'invention_card'
            ? JSON.stringify(m)
            : m.message,
      }));

      const effectiveEventId = targetEventId || activeEventId;

      const res = await sendChatMessage({
        message: trimmed,
        history: historyContext,
        eventId: effectiveEventId,
      });

      if (res && res.data) {
        const botResponse = res.data;
        if (botResponse.eventId) {
          setActiveEventId(botResponse.eventId);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            role: 'assistant',
            type: botResponse.type || (res.success ? 'text' : 'qr_error'),
            message: botResponse.message || (res.success ? '' : 'Unable to complete request. Please try again.'),
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

  /**
   * ChatGPT-like Voice Input State Machine & Lifecycle
   */
  const toggleVoiceRecognition = () => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition || null
        : null;

    if (!SpeechRecognition) {
      setVoiceError('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      setVoiceState('error');
      setTimeout(() => {
        setVoiceState('idle');
        setVoiceError('');
      }, 4500);
      return;
    }

    // If currently listening, stop immediately
    if (voiceState === 'listening') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setVoiceState('idle');
      setInterimTranscript('');
      return;
    }

    // Increment session ID to discard stale callbacks from older instances
    sessionIdRef.current += 1;
    const currentSessionId = sessionIdRef.current;

    // Reset session refs
    finalTranscriptRef.current = '';
    submittedRef.current = false;
    setInterimTranscript('');
    setVoiceError('');

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = voiceLanguage;
      recognition.continuous = false; // single complete utterance session
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (sessionIdRef.current !== currentSessionId) return;
        setVoiceState('listening');
        setVoiceError('');
      };

      recognition.onresult = (event) => {
        if (sessionIdRef.current !== currentSessionId) return;

        let currentInterim = '';
        let accumulatedFinal = '';

        for (let i = 0; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            accumulatedFinal += (accumulatedFinal ? ' ' : '') + result[0].transcript.trim();
          } else {
            currentInterim += (currentInterim ? ' ' : '') + result[0].transcript.trim();
          }
        }

        if (accumulatedFinal) {
          finalTranscriptRef.current = accumulatedFinal;
        }

        // Show interim transcript live only in preview, never append to chat history
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event) => {
        if (sessionIdRef.current !== currentSessionId) return;
        console.warn('[SpeechRecognition error]', event.error);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError('Microphone access denied. Please allow microphone permissions in your browser.');
          setVoiceState('error');
        } else if (event.error === 'no-speech') {
          // User stayed silent
          setVoiceState('idle');
        } else if (event.error !== 'aborted') {
          setVoiceError(`Voice input error: ${event.error}`);
          setVoiceState('error');
        } else {
          setVoiceState('idle');
        }

        setTimeout(() => {
          setVoiceState('idle');
          setVoiceError('');
        }, 4000);
      };

      recognition.onend = () => {
        if (sessionIdRef.current !== currentSessionId) return;

        const speechToSubmit = (finalTranscriptRef.current || '').trim();
        setInterimTranscript('');

        // SUBMISSION GUARD: Ensure exactly ONE submission per spoken utterance
        if (speechToSubmit && !submittedRef.current) {
          submittedRef.current = true;
          setVoiceState('processing');

          // Submit the message cleanly exactly once
          handleSend(speechToSubmit);

          setTimeout(() => {
            setInputMessage('');
            finalTranscriptRef.current = '';
            setVoiceState('idle');
          }, 200);
        } else {
          setVoiceState('idle');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[SpeechRecognition start error]', err);
      setVoiceState('error');
      setVoiceError('Could not start microphone. Please check permissions.');
      setTimeout(() => {
        setVoiceState('idle');
        setVoiceError('');
      }, 3500);
    }
  };

  /**
   * Text-to-speech for assistant messages
   */
  const handleSpeakText = (messageId, rawText) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanSpeech = String(rawText || '')
      .replace(/```[\s\S]*?```/g, ' Code snippet. ')
      .replace(/[*_#`~\[\]\(\)]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' link ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanSpeech) return;

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = voiceLanguage;
    utterance.rate = 1.0;

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
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

  // Determine suggestions based on context
  const activeSuggestions = eventContext?.title
    ? getEventContextSuggestions(eventContext.title)
    : user?.role === 'EVENTADMIN'
    ? ADMIN_GENERAL_SUGGESTIONS
    : STUDENT_GENERAL_SUGGESTIONS;

  // Render individual message content
  const renderMessageContent = (m) => {
    if (m.type === 'image_search' || (Array.isArray(m.images) && m.images.length > 0)) {
      return <ChatImageGallery card={m} />;
    }

    if (m.type === 'registration_qr') {
      return <ChatRegistrationQRCard card={m} />;
    }

    if (m.type === 'invention_card') {
      return <InventionCard card={m} />;
    }

    if (m.type === 'qr_error') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: '#F87171',
              fontWeight: '600',
              fontSize: '0.85rem',
            }}
          >
            <AlertCircle size={15} />
            <span>{m.message || 'Unable to retrieve registration QR.'}</span>
          </div>
          {m.eventTitle && (
            <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              Event: {m.eventTitle}
            </div>
          )}
          <button
            onClick={() =>
              handleSend(
                `Show registration QR for ${m.eventTitle || 'this event'}`,
                m.eventId
              )
            }
            disabled={loading}
            style={{
              alignSelf: 'flex-start',
              padding: '0.3rem 0.65rem',
              fontSize: '0.74rem',
              borderRadius: '0.4rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#FCA5A5',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              marginTop: '0.2rem',
            }}
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    return (
      <div>
        <FormattedMessageText text={m.message} />
        {m.role === 'assistant' && (
          <button
            type="button"
            onClick={() => handleSpeakText(m.id, m.message)}
            title={speakingMessageId === m.id ? 'Stop audio' : 'Listen aloud'}
            style={{
              background: 'transparent',
              border: 'none',
              color: speakingMessageId === m.id ? '#EC4899' : 'rgba(148, 163, 184, 0.7)',
              cursor: 'pointer',
              padding: '0.2rem',
              borderRadius: '0.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.72rem',
              marginTop: '0.45rem',
              transition: 'color 0.2s ease',
            }}
          >
            {speakingMessageId === m.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
            <span>{speakingMessageId === m.id ? 'Stop' : 'Listen'}</span>
          </button>
        )}
      </div>
    );
  };

  // Shared inner chat layout renderer
  const renderChatBody = ({ isModal = false } = {}) => (
    <>
      {/* Header */}
      <div
        style={{
          padding: isModal ? '0.9rem 1.25rem' : '1.15rem 1.6rem',
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: isModal ? '36px' : '42px',
              height: isModal ? '36px' : '42px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.45)',
              flexShrink: 0,
            }}
          >
            <Bot size={isModal ? 20 : 23} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: isModal ? '1.02rem' : '1.2rem',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  letterSpacing: '-0.01em',
                }}
              >
                EventSync AI Assistant
              </h2>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '0.12rem 0.5rem',
                  borderRadius: 'var(--radius-full, 9999px)',
                  fontSize: '0.68rem',
                  color: '#34D399',
                  fontWeight: '600',
                }}
              >
                <span
                  className="chat-status-dot-pulse"
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#10B981',
                  }}
                />
                <span>Online</span>
              </div>
              {eventContext?.title && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: '#C7D2FE',
                    background: 'rgba(99, 102, 241, 0.25)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    padding: '0.12rem 0.5rem',
                    borderRadius: 'var(--radius-full, 9999px)',
                    fontWeight: '600',
                    maxWidth: '180px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={eventContext.title}
                >
                  📍 {eventContext.title}
                </span>
              )}
            </div>
            <span style={{ fontSize: isModal ? '0.74rem' : '0.8rem', color: '#A5B4FC' }}>
              Campus Guide & Multimodal AI • English + Telugu
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={handleClearChat}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#CBD5E1',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '0.45rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Clear conversation"
          >
            <Trash2 size={16} />
          </button>
          {isModal && (
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#CBD5E1',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '0.45rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          {isModal && (
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#CBD5E1',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '0.45rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close chat"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Message Stream */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isModal ? '1rem 1.15rem' : '1.25rem 1.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className="chat-message-animated"
            style={{
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'flex-start',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: m.role === 'user' ? '80%' : '90%',
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: isModal ? '30px' : '34px',
                height: isModal ? '30px' : '34px',
                borderRadius: '50%',
                background:
                  m.role === 'user'
                    ? 'linear-gradient(135deg, #EC4899, #8B5CF6)'
                    : 'linear-gradient(135deg, #4F46E5, #6366F1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                flexShrink: 0,
                fontSize: '0.78rem',
                boxShadow:
                  m.role === 'user'
                    ? '0 2px 8px rgba(236, 72, 153, 0.35)'
                    : '0 2px 8px rgba(99, 102, 241, 0.35)',
              }}
            >
              {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
            </div>

            {/* Message Bubble Card */}
            <div
              style={{
                padding: isModal ? '0.75rem 1rem' : '0.85rem 1.15rem',
                borderRadius: '1rem',
                borderTopRightRadius: m.role === 'user' ? '0.2rem' : '1rem',
                borderTopLeftRadius: m.role === 'user' ? '1rem' : '0.2rem',
                background:
                  m.role === 'user'
                    ? 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)'
                    : 'rgba(30, 41, 59, 0.88)',
                border: '1px solid',
                borderColor:
                  m.role === 'user' ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)',
                color: '#F8FAFC',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
              }}
            >
              {renderMessageContent(m)}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div
            className="chat-message-animated"
            style={{
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'center',
              alignSelf: 'flex-start',
            }}
          >
            <div
              style={{
                width: isModal ? '30px' : '34px',
                height: isModal ? '30px' : '34px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <Bot size={15} />
            </div>
            <div
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '1rem',
                borderTopLeftRadius: '0.2rem',
                background: 'rgba(30, 41, 59, 0.88)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: '#C7D2FE',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span
                  className="chat-typing-dot-1"
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#818CF8',
                  }}
                />
                <span
                  className="chat-typing-dot-2"
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#A855F7',
                  }}
                />
                <span
                  className="chat-typing-dot-3"
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#EC4899',
                  }}
                />
              </div>
              <span>EventSync Assistant is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Modern Suggestion Chips */}
      <div
        style={{
          padding: isModal ? '0.5rem 1rem' : '0.65rem 1.5rem',
          background: 'rgba(15, 23, 42, 0.65)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          gap: '0.45rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {activeSuggestions.map((item, idx) => {
          const IconComp = item.icon || Sparkles;
          return (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSend(item.label)}
              style={{
                whiteSpace: 'nowrap',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full, 9999px)',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#C7D2FE',
                fontSize: isModal ? '0.74rem' : '0.78rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
              }}
            >
              <IconComp size={12} style={{ color: '#818CF8' }} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Voice Listening Banner */}
      {voiceState === 'listening' && (
        <div
          style={{
            padding: '0.5rem 1.25rem',
            background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.25), rgba(139, 92, 246, 0.25))',
            borderTop: '1px solid rgba(236, 72, 153, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: '#F472B6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#EC4899',
                boxShadow: '0 0 10px #EC4899',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontWeight: '600' }}>
                Listening in {voiceLanguage === 'te-IN' ? 'Telugu (తెలుగు)' : 'English'}...
              </span>
              {interimTranscript && (
                <span style={{ color: '#FDF2F8', fontStyle: 'italic' }}>
                  "{interimTranscript}"
                </span>
              )}
            </div>
          </div>
          <button
            onClick={toggleVoiceRecognition}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#CBD5E1',
              cursor: 'pointer',
              fontSize: '0.75rem',
              textDecoration: 'underline',
              fontWeight: '600',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Voice Error Banner */}
      {voiceError && (
        <div
          style={{
            padding: '0.4rem 1.25rem',
            background: 'rgba(239, 68, 68, 0.18)',
            borderTop: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#FCA5A5',
            fontSize: '0.76rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <AlertCircle size={13} />
          <span>{voiceError}</span>
        </div>
      )}

      {/* Input Container */}
      <div
        style={{
          padding: isModal ? '0.75rem 1rem' : '1rem 1.5rem',
          background: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={
              voiceState === 'listening'
                ? interimTranscript ? `Listening: "${interimTranscript}"` : 'Listening... Speak now'
                : 'Ask anything, search images, or request registration QR...'
            }
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="form-input"
            style={{
              width: '100%',
              padding: isModal ? '0.65rem 0.9rem' : '0.75rem 1.15rem',
              borderRadius: 'var(--radius-full, 9999px)',
              background: 'rgba(30, 41, 59, 0.75)',
              border: voiceState === 'listening' ? '1px solid #EC4899' : '1px solid rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              fontSize: isModal ? '0.86rem' : '0.92rem',
              outline: 'none',
              boxShadow: voiceState === 'listening' ? '0 0 12px rgba(236, 72, 153, 0.3)' : 'none',
              transition: 'all 0.2s ease',
            }}
          />
        </div>

        {/* Voice Language Toggle (EN / TE) */}
        <button
          type="button"
          onClick={() => setVoiceLanguage((prev) => (prev === 'en-IN' ? 'te-IN' : 'en-IN'))}
          title={`Switch voice language (Current: ${voiceLanguage === 'en-IN' ? 'English (en-IN)' : 'Telugu (te-IN)'})`}
          style={{
            padding: '0.35rem 0.55rem',
            borderRadius: 'var(--radius-full, 9999px)',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#CBD5E1',
            fontSize: '0.72rem',
            fontWeight: '700',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
        >
          {voiceLanguage === 'en-IN' ? 'EN' : 'TE'}
        </button>

        {/* Microphone Button with Active Listening Pulse */}
        <button
          type="button"
          onClick={toggleVoiceRecognition}
          className={voiceState === 'listening' ? 'chat-voice-listening' : ''}
          title={
            voiceState === 'listening'
              ? 'Stop listening'
              : `Voice input (${voiceLanguage === 'en-IN' ? 'English' : 'Telugu'})`
          }
          style={{
            width: isModal ? '38px' : '44px',
            height: isModal ? '38px' : '44px',
            borderRadius: '50%',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background:
              voiceState === 'listening'
                ? 'linear-gradient(135deg, #EC4899 0%, #EF4444 100%)'
                : 'rgba(99, 102, 241, 0.15)',
            border: voiceState === 'listening' ? '2px solid #F43F5E' : '1px solid rgba(99, 102, 241, 0.35)',
            color: voiceState === 'listening' ? '#FFFFFF' : '#A5B4FC',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {voiceState === 'listening' ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Send Button */}
        <button
          onClick={() => handleSend()}
          disabled={!inputMessage.trim() || loading}
          className="btn btn-primary"
          style={{
            width: isModal ? '38px' : '44px',
            height: isModal ? '38px' : '44px',
            borderRadius: '50%',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            border: 'none',
            color: '#FFFFFF',
            cursor: !inputMessage.trim() || loading ? 'not-allowed' : 'pointer',
            opacity: !inputMessage.trim() || loading ? 0.6 : 1,
            boxShadow: !inputMessage.trim() || loading ? 'none' : '0 4px 14px rgba(99, 102, 241, 0.4)',
            transition: 'all 0.2s ease',
          }}
          title="Send Message"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </>
  );

  // Standalone Mode (Full page view /chat)
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
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: '1.25rem',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5), 0 0 24px rgba(99, 102, 241, 0.2)',
        }}
      >
        {renderChatBody({ isModal: false })}
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
            e.currentTarget.style.boxShadow =
              '0 12px 32px rgba(99, 102, 241, 0.65), 0 0 20px rgba(168, 85, 247, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow =
              '0 8px 24px rgba(99, 102, 241, 0.5), 0 0 16px rgba(168, 85, 247, 0.4)';
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={28} />
            <span
              className="chat-status-dot-pulse"
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
            width: isExpanded ? 'min(92vw, 760px)' : 'min(94vw, 440px)',
            height: isExpanded ? 'min(88vh, 780px)' : 'min(82vh, 600px)',
            borderRadius: '1.25rem',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), 0 0 24px rgba(99, 102, 241, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 99999,
            overflow: 'hidden',
          }}
        >
          {renderChatBody({ isModal: true })}
        </div>
      )}
    </>
  );
};
