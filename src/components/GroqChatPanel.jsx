import { useEffect, useRef, useState } from 'react';
import { sendGroqMessage } from '../services/groqClient';

const SUBMIT_COOLDOWN_MS = 800;

export default function GroqChatPanel({ configured, newsBriefing, onClose = null, embedded = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(configured ? null : 'API key not configured. Add GROQ_API_KEY to enable chat.');
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const lastSubmitRef = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, error]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setError(configured ? null : 'API key not configured. Add GROQ_API_KEY to enable chat.');
  }, [configured]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending || !configured) return;

    const now = Date.now();
    if (now - lastSubmitRef.current < SUBMIT_COOLDOWN_MS) return;
    lastSubmitRef.current = now;

    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);
    setError(null);

    try {
      const payload = [
        {
          role: 'system',
          content: 'You are a helpful general-purpose assistant. Answer clearly and directly.',
        },
        ...nextMessages.map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content,
        })),
      ];

      const result = await sendGroqMessage(payload, newsBriefing);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  function handleClear() {
    setMessages([]);
    setError(configured ? null : 'API key not configured. Add GROQ_API_KEY to enable chat.');
    setInput('');
    inputRef.current?.focus();
  }

  return (
    <div
      className={`groq-chat__surface${embedded ? ' groq-chat__surface--embedded' : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="groq-chat__header">
        <div>
          <h2 className="groq-chat__title">Anchors Chat</h2>
        </div>
        <div className="groq-chat__actions">
          <button className="groq-chat__ghost" onClick={handleClear} type="button">
            Clear chat
          </button>
          {onClose && (
            <button className="groq-chat__close" onClick={onClose} type="button" aria-label="Close chat">
              ×
            </button>
          )}
        </div>
      </header>

      <div className="groq-chat__messages">
        {messages.length === 0 && (
          <div className="groq-chat__empty">
            <h3>Ask a question</h3>
            <p>Try a quick summary, key takeaway, or comparison.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`groq-chat__message groq-chat__message--${message.role}`}
          >
            {message.content}
          </div>
        ))}

        {isSending && (
          <div className="groq-chat__message groq-chat__message--assistant groq-chat__message--loading">
            <span />
            <span />
            <span />
          </div>
        )}

        {error && <div className="groq-chat__status groq-chat__status--error">{error}</div>}
        <div ref={endRef} />
      </div>

      <form className="groq-chat__composer" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="groq-chat__input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={configured ? 'Message Groq...' : 'API key not configured'}
          disabled={isSending || !configured}
        />
        <button
          className="groq-chat__send"
          type="submit"
          disabled={isSending || !configured || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
