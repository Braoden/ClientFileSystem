import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import './App.css';

export default function App() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    const data = await res.json();
    setClients(data);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleClientCreated = () => fetchClients();
  const handleClientDeleted = (id) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (selectedClient?.id === id) setSelectedClient(null);
  };

  return (
    <div className="app-layout">
      <Sidebar
        clients={clients}
        selectedClient={selectedClient}
        onSelectClient={setSelectedClient}
        onClientCreated={handleClientCreated}
        onClientDeleted={handleClientDeleted}
      />
      <main className="main-panel">
        {selectedClient ? (
          <ChatPanel client={selectedClient} />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <h2>Select a client to start chatting</h2>
            <p>Choose a client from the sidebar or create a new one.</p>
          </div>
        )}
      </main>
    </div>
  );
}
