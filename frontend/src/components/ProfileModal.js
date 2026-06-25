import React, { useState } from 'react';
import './ApiKeyModal.css';

export default function ProfileModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: client.name || '',
    dateOfBirth: client.dateOfBirth || '',
    notes: client.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/clients/${client.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      const updated = await res.json();
      setSaved(true);
      onSaved(updated);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
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
          <h2>Profile Settings</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="modal-body" onSubmit={handleSave}>
          {error && <div className="error-banner">⚠️ {error}</div>}
          <label>
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Client name"
              required
              style={{ fontFamily: 'inherit' }}
            />
          </label>
          <label>
            Date of Birth
            <input
              type="text"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              placeholder="e.g. 1990-04-15"
              style={{ fontFamily: 'inherit' }}
            />
          </label>
          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any notes about this client…"
              rows={4}
              style={{ fontFamily: 'inherit', resize: 'vertical' }}
            />
          </label>
          <button type="submit" disabled={loading}>
            {saved ? '✓ Saved' : loading ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
