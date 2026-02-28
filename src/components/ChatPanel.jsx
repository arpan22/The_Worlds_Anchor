import { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

/**
 * ChatPanel — country chat powered by Gemini.
 */
export default function ChatPanel({
  messages,
  isSending,
  onSend,
  disabled,
  disabledReason,
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || disabled || isSending) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <section className="chat">
      <h3 className="chat__heading">
        <span className="chat__nvidia-badge">Google Gemini</span>
        Ask about the news
      </h3>

      {/* Messages area */}
      <div className="chat__messages">
        {disabled && (
          <div className="chat__disabled-notice">
            <div className="chat__disabled-pulse" />
            <span>{disabledReason || 'Building brief...'}</span>
          </div>
        )}

        {!disabled && messages.length === 0 && (
          <div className="chat__empty">
            Ask any question about this country&apos;s current news.
            Responses come from the current Gemini chat session.
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat__msg chat__msg--${msg.role}${msg.isError ? ' chat__msg--error' : ''}`}
          >
            {/* Source type indicator for assistant messages */}
            {msg.role === 'assistant' && !msg.isError && msg.sourceType && (
              <div className={`chat__source-indicator chat__source-indicator--${
                msg.sourceType === 'augmented_with_web' ? 'web'
                  : msg.sourceType === 'gemini_failed' ? 'failed'
                  : 'news'
              }`}>
                {msg.sourceType === 'gemini'
                  ? 'Answered by Gemini'
                  : msg.sourceType === 'augmented_with_web'
                  ? 'Expanded with web sources (Gemini)'
                  : msg.sourceType === 'gemini_failed'
                  ? 'Gemini unavailable — news sources only'
                  : 'Answered from news sources'}
              </div>
            )}

            <div className="chat__msg-content">
              {msg.content}
            </div>

            {/* News citations */}
            {msg.sources?.news && msg.sources.news.length > 0 && (
              <div className="chat__sources chat__sources--news">
                <span className="chat__sources-label">News sources:</span>
                {msg.sources.news.slice(0, 5).map((src, j) => (
                  <a
                    key={j}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chat__source-link chat__source-link--news"
                    title={src.title}
                  >
                    {src.source || src.title}
                  </a>
                ))}
              </div>
            )}

            {/* Web citations */}
            {msg.sources?.web && msg.sources.web.length > 0 && (
              <div className="chat__sources chat__sources--web">
                <span className="chat__sources-label">Web sources:</span>
                {msg.sources.web.slice(0, 5).map((src, j) => (
                  <a
                    key={j}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chat__source-link chat__source-link--web"
                    title={src.title}
                  >
                    {src.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="chat__msg chat__msg--assistant chat__msg--loading">
            <div className="chat__typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form className="chat__input-area" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="chat__input"
          placeholder={disabled ? 'Building brief...' : 'Ask about the news...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || isSending}
        />
        <button
          type="submit"
          className="chat__send-btn"
          disabled={disabled || isSending || !input.trim()}
          aria-label="Send message"
        >
          &rarr;
        </button>
      </form>
    </section>
  );
}
