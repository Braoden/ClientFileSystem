import React, { useState, useEffect, useRef } from 'react';
import './ChatPanel.css';
import paperclipIcon from './paperclip.png';

function Paperclip() {
  return <img src={paperclipIcon} alt="" className="attach-icon" />;
}

export default function ChatPanel({ client }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]); // staged files for this message
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/clients/${client.id}/chat`);
        if (!res.ok) throw new Error('Failed to load chat history');
        setMessages(await res.json());
        setError('');
      } catch (err) {
        setError(err.message);
        setMessages([]);
      }
    };
    fetchHistory();
    setAttachments([]);
  }, [client.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setError('');
    const uploaded = [];
    const failed = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`/api/clients/${client.id}/files`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error();
        uploaded.push(await res.json());
      } catch {
        failed.push(file.name);
      }
    }
    if (failed.length) setError(`Failed to attach: ${failed.join(', ')}`);
    setAttachments((prev) => [...prev, ...uploaded]);
    setUploading(false);
    e.target.value = '';
  };

  const removeAttachment = (filename) => {
    setAttachments((prev) => prev.filter((a) => a.filename !== filename));
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMsg = {
      role: 'user',
      content: input,
      attachments: attachments.map((a) => a.originalName),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const sentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/clients/${client.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, attachments: sentAttachments }),
      });
      // Errors raised before streaming begins (e.g. missing key) come back as JSON.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Request failed');
      }

      // Append an empty assistant message, then fill it as deltas stream in.
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', timestamp: new Date().toISOString() },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistant = '';

      const appendDelta = (delta) => {
        assistant += delta;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: assistant };
          return copy;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop(); // keep incomplete trailing chunk
        for (const evt of events) {
          const line = evt.replace(/^data: /, '').trim();
          if (!line) continue;
          const payload = JSON.parse(line);
          if (payload.error) throw new Error(payload.error);
          if (payload.delta) appendDelta(payload.delta);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (!window.confirm('Clear all chat history for this client?')) return;
    try {
      const res = await fetch(`/api/clients/${client.id}/chat`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear chat history');
      setMessages([]);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="client-profile-card">
          <div className="profile-avatar">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="profile-details">
            <div className="profile-name">{client.name}</div>
            <div className="profile-meta">
              {client.dateOfBirth && (
                <span className="profile-field">
                  <span className="profile-label">DOB</span>
                  {client.dateOfBirth}
                </span>
              )}
            </div>
            {client.notes && (
              <div className="profile-notes">{client.notes}</div>
            )}
          </div>
        </div>
        <button className="btn-clear" onClick={clearChat} title="Clear chat history">
          Clear chat
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} title="Dismiss">✕</button>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Ask anything about <strong>{client.name}</strong>.</p>
            <p>The AI has their full profile loaded as context.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.attachments?.length > 0 && (
              <div className="message-attachments">
                {msg.attachments.map((name, j) => (
                  <span key={j} className="attachment-chip">📎 {name}</span>
                ))}
              </div>
            )}
            <div className="message-bubble">
              {msg.role === 'assistant' && msg.content === '' ? (
                <span className="typing"><span /><span /><span /></span>
              ) : (
                msg.content
              )}
            </div>
            {msg.timestamp && (
              <div className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {attachments.length > 0 && (
        <div className="staged-attachments">
          {attachments.map((a) => (
            <div key={a.filename} className="staged-chip">
              📎 {a.originalName}
              <button onClick={() => removeAttachment(a.filename)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <form className="chat-input-bar" onSubmit={sendMessage}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          style={{ display: 'none' }}
          accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.gif,.webp,.html"
        />
        <button
          type="button"
          className="btn-attach"
          onClick={() => fileInputRef.current.click()}
          disabled={uploading}
          title="Attach file"
          aria-label="Attach file"
        >
          {uploading ? '⏳' : <Paperclip />}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message about ${client.name}…`}
          disabled={loading}
        />
        <button type="submit" disabled={loading || (!input.trim() && attachments.length === 0)}>
          Send
        </button>
      </form>
    </div>
  );
}
