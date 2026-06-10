import React, { useState } from 'react';
import SettingsModal from './SettingsModal';
import './Sidebar.css';

export default function Sidebar({ clients, selectedClient, onSelectClient, onClientCreated, onClientDeleted }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', dateOfBirth: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ name: '', dateOfBirth: '', notes: '' });
    setShowForm(false);
    setLoading(false);
    onClientCreated();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this client and all their data?')) return;
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    onClientDeleted(id);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">📁 Clients</span>
        <button className="btn-icon" onClick={() => setShowForm((v) => !v)} title="New client">
          {showForm ? '✕' : '+'}
        </button>
      </div>

      {showForm && (
        <form className="new-client-form" onSubmit={handleCreate}>
          <input
            placeholder="Client name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
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
          <button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create Client'}
          </button>
        </form>
      )}

      <div className="search-bar">
        <input
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ul className="client-list">
        {clients.length === 0 && (
          <li className="no-clients">No clients yet. Click + to add one.</li>
        )}
        {clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())).map((client) => (
          <li
            key={client.id}
            className={`client-item ${selectedClient?.id === client.id ? 'active' : ''}`}
            onClick={() => onSelectClient(client)}
          >
            <div className="client-icon">👤</div>
            <div className="client-info">
              <span className="client-name">{client.name}</span>
              {client.dateOfBirth && <span className="client-industry">DOB: {client.dateOfBirth}</span>}
            </div>
            <button
              className="btn-delete"
              onClick={(e) => handleDelete(e, client.id)}
              title="Delete client"
            >
              🗑
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <button className="btn-settings" onClick={() => setShowSettings(true)} title="Settings">
          ⚙️ Settings
        </button>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </aside>
  );
}
