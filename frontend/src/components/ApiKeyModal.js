import React, { useState, useEffect } from 'react';
import './ApiKeyModal.css';

export default function ApiKeyModal({ onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setApiKey(d.apiKey || ''))
      .catch(() => setError('Could not load settings.'));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="modal-body" onSubmit={handleSave}>
          {error && <div className="error-banner">⚠️ {error}</div>}
          <label>
            Anthropic API Key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
            <span className="field-hint">
              Your key is stored locally and never sent anywhere except Anthropic.
            </span>
          </label>

          <button type="submit" disabled={loading}>
            {saved ? '✓ Saved' : loading ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
