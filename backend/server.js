const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Data root: Electron passes DATA_DIR (userData) in packaged builds, where
// the install directory is read-only. In dev it defaults to the repo root.
const DATA_ROOT = process.env.DATA_DIR || path.join(__dirname, '..');

// Root directory where client folders live
const CLIENTS_DIR = path.join(DATA_ROOT, 'clients');
if (!fs.existsSync(CLIENTS_DIR)) fs.mkdirSync(CLIENTS_DIR, { recursive: true });

function getAnthropicClient() {
  const settings = loadSettings();
  const apiKey = settings.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No API key configured. Please add one in Settings.');
  return new Anthropic({ apiKey });
}

// ── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_PATH = path.join(DATA_ROOT, 'settings.json');

function loadSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
}

app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  res.json({ apiKey: settings.apiKey ? '••••••••' + settings.apiKey.slice(-4) : '' });
});

app.post('/api/settings', (req, res) => {
  const settings = loadSettings();
  if (req.body.apiKey) settings.apiKey = req.body.apiKey;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  res.json({ success: true });
});

// ── Client CRUD ──────────────────────────────────────────────────────────────

app.get('/api/clients', (req, res) => {
  const entries = fs.readdirSync(CLIENTS_DIR, { withFileTypes: true });
  const clients = entries
    .filter((e) => e.isDirectory())
    .map((e) => {
      const profilePath = path.join(CLIENTS_DIR, e.name, 'profile.json');
      const profile = fs.existsSync(profilePath)
        ? JSON.parse(fs.readFileSync(profilePath, 'utf8'))
        : {};
      return { id: e.name, ...profile };
    });
  res.json(clients);
});

app.get('/api/clients/:id/profile', (req, res) => {
  const profilePath = path.join(CLIENTS_DIR, req.params.id, 'profile.json');
  if (!fs.existsSync(profilePath)) return res.status(404).json({ error: 'Not found' });
  res.json(JSON.parse(fs.readFileSync(profilePath, 'utf8')));
});

app.post('/api/clients', (req, res) => {
  const { name, dateOfBirth, notes } = req.body;
  const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
  const clientDir = path.join(CLIENTS_DIR, id);
  fs.mkdirSync(clientDir);
  const profile = { id, name, dateOfBirth, notes, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(clientDir, 'profile.json'), JSON.stringify(profile, null, 2));
  fs.writeFileSync(path.join(clientDir, 'chat_history.json'), JSON.stringify([], null, 2));
  res.json(profile);
});

app.put('/api/clients/:id/profile', (req, res) => {
  const profilePath = path.join(CLIENTS_DIR, req.params.id, 'profile.json');
  if (!fs.existsSync(profilePath)) return res.status(404).json({ error: 'Not found' });
  const updated = { ...JSON.parse(fs.readFileSync(profilePath, 'utf8')), ...req.body };
  fs.writeFileSync(profilePath, JSON.stringify(updated, null, 2));
  res.json(updated);
});

app.delete('/api/clients/:id', (req, res) => {
  const clientDir = path.join(CLIENTS_DIR, req.params.id);
  if (!fs.existsSync(clientDir)) return res.status(404).json({ error: 'Not found' });
  fs.rmSync(clientDir, { recursive: true });
  res.json({ success: true });
});

// ── File uploads ──────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const filesDir = path.join(CLIENTS_DIR, req.params.id, 'files');
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir);
    cb(null, filesDir);
  },
  filename: (req, file, cb) => {
    // Preserve original name, prefix with timestamp to avoid collisions
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB

app.post('/api/clients/:id/files', upload.single('file'), (req, res) => {
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});

app.get('/api/clients/:id/files', (req, res) => {
  const filesDir = path.join(CLIENTS_DIR, req.params.id, 'files');
  if (!fs.existsSync(filesDir)) return res.json([]);
  const files = fs.readdirSync(filesDir).map((f) => {
    const stat = fs.statSync(path.join(filesDir, f));
    const originalName = f.replace(/^\d+-/, '');
    return { filename: f, originalName, size: stat.size };
  });
  res.json(files);
});

app.get('/api/clients/:id/files/:filename/serve', (req, res) => {
  const filePath = path.join(CLIENTS_DIR, req.params.id, 'files', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

app.delete('/api/clients/:id/files/:filename', (req, res) => {
  const filePath = path.join(CLIENTS_DIR, req.params.id, 'files', req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

// ── Chat history ──────────────────────────────────────────────────────────────

app.get('/api/clients/:id/chat', (req, res) => {
  const chatPath = path.join(CLIENTS_DIR, req.params.id, 'chat_history.json');
  if (!fs.existsSync(chatPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(chatPath, 'utf8')));
});

// ── Anthropic proxy ───────────────────────────────────────────────────────────

const TEXT_TYPES = ['text/plain', 'text/csv', 'text/markdown', 'application/json', 'text/html'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function buildFileContentBlock(filePath, mimetype) {
  if (TEXT_TYPES.some((t) => mimetype.startsWith(t.split('/')[0]) && mimetype.includes(t.split('/')[1])) || mimetype.startsWith('text/')) {
    return { type: 'text', text: `[File contents]\n${fs.readFileSync(filePath, 'utf8')}` };
  }
  if (IMAGE_TYPES.includes(mimetype)) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: mimetype, data: fs.readFileSync(filePath).toString('base64') },
    };
  }
  if (mimetype === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: fs.readFileSync(filePath).toString('base64') },
    };
  }
  // Fallback: try reading as text
  return { type: 'text', text: `[File: ${path.basename(filePath)}]\n${fs.readFileSync(filePath, 'utf8')}` };
}

app.post('/api/clients/:id/chat', async (req, res) => {
  const { message, attachments = [] } = req.body;
  const clientId = req.params.id;

  const profilePath = path.join(CLIENTS_DIR, clientId, 'profile.json');
  const chatPath = path.join(CLIENTS_DIR, clientId, 'chat_history.json');

  if (!fs.existsSync(profilePath)) return res.status(404).json({ error: 'Client not found' });

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const history = fs.existsSync(chatPath)
    ? JSON.parse(fs.readFileSync(chatPath, 'utf8'))
    : [];

  const systemPrompt = `You are a helpful assistant with detailed knowledge about a specific client.
Here is everything known about this client:

${JSON.stringify(profile, null, 2)}

Answer questions about this client accurately and helpfully. If you don't know something, say so.`;

  // Build content blocks for the current user message
  const userContent = [];

  // Attach files first
  for (const att of attachments) {
    const filePath = path.join(CLIENTS_DIR, clientId, 'files', att.filename);
    if (!fs.existsSync(filePath)) continue;
    try {
      userContent.push(buildFileContentBlock(filePath, att.mimetype));
    } catch (e) {
      userContent.push({ type: 'text', text: `[Could not read file: ${att.originalName}]` });
    }
  }

  userContent.push({ type: 'text', text: message });

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];

  let anthropic;
  try {
    anthropic = getAnthropicClient();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const assistantMessage = response.content[0].text;

    const updatedHistory = [
      ...history,
      {
        role: 'user',
        content: message,
        attachments: attachments.map((a) => a.originalName),
        timestamp: new Date().toISOString(),
      },
      { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() },
    ];
    fs.writeFileSync(chatPath, JSON.stringify(updatedHistory, null, 2));

    res.json({ message: assistantMessage, history: updatedHistory });
  } catch (err) {
    console.error('Anthropic error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/clients/:id/chat', (req, res) => {
  const chatPath = path.join(CLIENTS_DIR, req.params.id, 'chat_history.json');
  fs.writeFileSync(chatPath, JSON.stringify([], null, 2));
  res.json({ success: true });
});

const FRONTEND_BUILD = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(FRONTEND_BUILD)) {
  app.use(express.static(FRONTEND_BUILD));
  app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_BUILD, 'index.html')));
}

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
