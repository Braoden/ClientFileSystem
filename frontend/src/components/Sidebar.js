import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileModal from './ProfileModal';
import './Sidebar.css';

const FILE_ICONS = {
  pdf: '📄', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', webp: '🖼',
  txt: '📝', md: '📝', csv: '📊', json: '📊', html: '🌐',
};

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📎';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Sidebar({ clients, selectedClient, onSelectClient, onClientCreated, onClientDeleted, onClientUpdated }) {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => {
    if (!selectedClient) { setFiles([]); return; }
    setFilesLoading(true);
    fetch(`/api/clients/${selectedClient.id}/files`)
      .then((r) => r.json())
      .then((data) => { setFiles(data); setFilesLoading(false); })
      .catch(() => setFilesLoading(false));
  }, [selectedClient]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">📁 Clients</span>
      </div>

      <button className="btn-nav-files" onClick={() => navigate('/')}>
        ◄ Back
      </button>

      <div className="sidebar-files-section">
        <div className="sidebar-files-label">
          {selectedClient ? `${selectedClient.name}'s Files` : 'Files'}
        </div>
        <div className="sidebar-files-list">
          {!selectedClient && (
            <p className="sidebar-files-empty">Select a client to see their files.</p>
          )}
          {selectedClient && filesLoading && (
            <p className="sidebar-files-empty">Loading…</p>
          )}
          {selectedClient && !filesLoading && files.length === 0 && (
            <p className="sidebar-files-empty">No files uploaded yet.</p>
          )}
          {files.map((f) => (
            <div
              key={f.filename}
              className="sidebar-file-item"
              onDoubleClick={() => window.open(`http://localhost:3001/api/clients/${selectedClient.id}/files/${f.filename}/serve`, '_blank')}
              title="Double-click to open"
            >
              <span className="sidebar-file-icon">{fileIcon(f.originalName)}</span>
              <div className="sidebar-file-info">
                <span className="sidebar-file-name" title={f.originalName}>{f.originalName}</span>
                <span className="sidebar-file-size">{formatSize(f.size)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <button
          className="btn-settings"
          onClick={() => selectedClient && setShowProfile(true)}
          disabled={!selectedClient}
          title={selectedClient ? 'Edit client profile' : 'Select a client first'}
        >
          ✏️ Client Profile Settings
        </button>
      </div>

      {showProfile && selectedClient && (
        <ProfileModal
          client={selectedClient}
          onClose={() => setShowProfile(false)}
          onSaved={(updated) => { onClientUpdated(updated); setShowProfile(false); }}
        />
      )}
    </aside>
  );
}
