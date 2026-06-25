import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import ClientFilesPage from './components/ClientFilesPage';
import ClientsPage from './components/ClientsPage';
import './App.css';

function ChatLayout({ clients, fetchClients }) {
  const location = useLocation();
  const [selectedClient, setSelectedClient] = useState(null);

  // If navigated here with a client pre-selected (from ClientsPage)
  useEffect(() => {
    if (location.state?.selectClientId && clients.length > 0) {
      const match = clients.find((c) => c.id === location.state.selectClientId);
      if (match) setSelectedClient(match);
    }
  }, [location.state, clients]);

  const handleClientDeleted = (id) => {
    if (selectedClient?.id === id) setSelectedClient(null);
    fetchClients();
  };

  const handleClientUpdated = (updated) => {
    setSelectedClient(updated);
    fetchClients();
  };

  return (
    <div className="app-layout">
      <Sidebar
        clients={clients}
        selectedClient={selectedClient}
        onSelectClient={setSelectedClient}
        onClientCreated={fetchClients}
        onClientDeleted={handleClientDeleted}
        onClientUpdated={handleClientUpdated}
      />
      <main className="main-panel">
        {selectedClient ? (
          <ChatPanel client={selectedClient} />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h2>No client selected</h2>
            <p>Use <strong>◄ Clients</strong> in the sidebar to select a client.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [clients, setClients] = useState([]);
  const [loadError, setLoadError] = useState('');

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to load clients');
      setClients(await res.json());
      setLoadError('');
    } catch (err) {
      setLoadError(err.message || 'Could not reach the server.');
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleClientDeleted = (id) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <HashRouter>
      {loadError && (
        <div className="error-banner">
          <span>⚠️ {loadError}</span>
          <button onClick={fetchClients} title="Retry">↻</button>
        </div>
      )}
      <Routes>
        <Route
          path="/"
          element={
            <ClientsPage
              clients={clients}
              onClientCreated={fetchClients}
              onClientDeleted={handleClientDeleted}
            />
          }
        />
        <Route path="/chat" element={<ChatLayout clients={clients} fetchClients={fetchClients} />} />
        <Route
          path="/client-files"
          element={<ClientFilesPage clients={clients} onClientsChanged={fetchClients} />}
        />
      </Routes>
    </HashRouter>
  );
}
