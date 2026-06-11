import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ClientFilesPage.css';

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

export default function ClientFilesPage({ clients, onClientsChanged }) {
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState(null);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (clients.length > 0 && !selectedClient) {
      setSelectedClient(clients[0]);
    }
  }, [clients, selectedClient]);

  useEffect(() => {
    if (!selectedClient) return;
    loadFiles(selectedClient.id);
  }, [selectedClient]);

  const loadFiles = async (clientId) => {
    setFilesLoading(true);
    const res = await fetch(`/api/clients/${clientId}/files`);
    const data = await res.json();
    setFiles(data);
    setFilesLoading(false);
  };

  const handleUpload = async (e) => {
    const picked = Array.from(e.target.files);
    if (!picked.length || !selectedClient) return;
    setUploading(true);
    for (const file of picked) {
      const fd = new FormData();
      fd.append('file', file);
      await fetch(`/api/clients/${selectedClient.id}/files`, { method: 'POST', body: fd });
    }
    e.target.value = '';
    setUploading(false);
    loadFiles(selectedClient.id);
  };

  const handleDelete = async (filename, originalName) => {
    if (!window.confirm(`Delete "${originalName}"? This cannot be undone.`)) return;
    setDeletingFile(filename);
    await fetch(`/api/clients/${selectedClient.id}/files/${filename}`, { method: 'DELETE' });
    setDeletingFile(null);
    loadFiles(selectedClient.id);
  };

  return (
    <div className="cfp-layout">
      <div className="cfp-topbar">
        <button className="cfp-back" onClick={() => navigate('/')}>
          ◄ Back to Chat
        </button>
        <h1 className="cfp-title">Client Files</h1>
      </div>

      <div className="cfp-body">
        {/* Left panel — client list */}
        <aside className="cfp-clients">
          <div className="cfp-clients-header">Clients</div>
          {clients.length === 0 && (
            <p className="cfp-empty">No clients yet.</p>
          )}
          {clients.map((c) => (
            <div
              key={c.id}
              className={`cfp-client-item ${selectedClient?.id === c.id ? 'active' : ''}`}
              onClick={() => setSelectedClient(c)}
            >
              <span className="cfp-client-avatar">{c.name.charAt(0).toUpperCase()}</span>
              <div className="cfp-client-info">
                <span className="cfp-client-name">{c.name}</span>
                {c.dateOfBirth && <span className="cfp-client-dob">DOB: {c.dateOfBirth}</span>}
              </div>
            </div>
          ))}
        </aside>

        {/* Right panel — files */}
        <main className="cfp-files">
          {!selectedClient ? (
            <div className="cfp-files-empty">Select a client to view their files.</div>
          ) : (
            <>
              <div className="cfp-files-header">
                <div className="cfp-files-heading">
                  <span className="cfp-files-avatar">{selectedClient.name.charAt(0).toUpperCase()}</span>
                  <span className="cfp-files-clientname">{selectedClient.name}</span>
                  <span className="cfp-files-count">
                    {filesLoading ? '…' : `${files.length} file${files.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <button
                  className="cfp-btn-upload"
                  onClick={() => fileInputRef.current.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : '+ Upload Files'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.gif,.webp,.html"
                  onChange={handleUpload}
                />
              </div>

              <div className="cfp-file-list">
                {filesLoading && <p className="cfp-files-empty">Loading…</p>}
                {!filesLoading && files.length === 0 && (
                  <div className="cfp-dropzone">
                    <span className="cfp-dropzone-icon">📂</span>
                    <p>No files yet.</p>
                    <p>Click <strong>Upload Files</strong> to add documents.</p>
                  </div>
                )}
                {!filesLoading && files.map((f) => (
                  <div key={f.filename} className="cfp-file-row">
                    <span className="cfp-file-icon">{fileIcon(f.originalName)}</span>
                    <div className="cfp-file-details">
                      <span className="cfp-file-name" title={f.originalName}>{f.originalName}</span>
                      <span className="cfp-file-meta">
                        {f.originalName.split('.').pop().toUpperCase()} · {formatSize(f.size)}
                      </span>
                    </div>
                    <button
                      className="cfp-btn-delete"
                      onClick={() => handleDelete(f.filename, f.originalName)}
                      disabled={deletingFile === f.filename}
                      title="Delete file"
                    >
                      {deletingFile === f.filename ? '…' : '🗑'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
