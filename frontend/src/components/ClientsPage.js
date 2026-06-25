import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiKeyModal from './ApiKeyModal';
import './ClientsPage.css';

export default function ClientsPage({ clients, onClientCreated, onClientDeleted }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState({ name: '', dateOfBirth: '', notes: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const filtered = [...clients]
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSelect = (client) => {
    navigate('/chat', { state: { selectClientId: client.id } });
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this client and all their data?')) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete client');
      onClientDeleted(id);
    } catch (err) {
      setCreateError(err.message);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create client');
      }
      setForm({ name: '', dateOfBirth: '', notes: '' });
      setShowForm(false);
      onClientCreated();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="cp-layout">
      <div className="cp-topbar">
        <h1 className="cp-title">📁 Clients</h1>        <button className="cp-btn-new" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '✕ Cancel' : '+ New Client'}
        </button>
        <button className="cp-btn-settings" onClick={() => setShowApiKey(true)} title="Settings">
          ⚙️
        </button>
      </div>

      {showApiKey && <ApiKeyModal onClose={() => setShowApiKey(false)} />}

      {createError && (
        <div className="error-banner">
          <span>⚠️ {createError}</span>
          <button onClick={() => setCreateError('')} title="Dismiss">✕</button>
        </div>
      )}

      {showForm && (
        <form className="cp-new-form" onSubmit={handleCreate}>
          <input
            placeholder="Client name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
          <input
            placeholder="Date of Birth (e.g. 1990-04-15)"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
          <button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create Client'}
          </button>
        </form>
      )}

      <div className="cp-search-wrap">
        <input
          className="cp-search"
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="cp-list">
        {filtered.length === 0 && (
          <div className="cp-empty">
            {search ? `No clients matching "${search}"` : 'No clients yet. Click + New Client to add one.'}
          </div>
        )}
        {filtered.map((client) => (
          <div key={client.id} className="cp-row" onClick={() => handleSelect(client)}>
            <div className="cp-avatar">{client.name.charAt(0).toUpperCase()}</div>
            <div className="cp-info">
              <span className="cp-name">{client.name}</span>
              <div className="cp-meta">
                {client.dateOfBirth && <span>DOB: {client.dateOfBirth}</span>}
                {client.notes && <span className="cp-notes">{client.notes}</span>}
              </div>
            </div>
            <button
              className="cp-btn-delete"
              onClick={(e) => handleDelete(e, client.id)}
              title="Delete client"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
