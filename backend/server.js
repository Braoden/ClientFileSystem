const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');

// safeStorage is only available when running inside Electron's main process.
// In standalone dev (`node backend/server.js`) it's absent and we fall back to
// plaintext — the packaged app, which is what ships, always has it.
let safeStorage;
try { ({ safeStorage } = require('electron')); } catch { /* dev: no electron */ }

const MODEL = 'claude-haiku-4-5-20251001';

const app = express();
const PORT = 3001;

// Renderer is same-origin in prod (served from 3001); dev runs on 3000.
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'] }));
app.use(express.json());

// Data root: Electron passes DATA_DIR (userData) in packaged builds, where
// the install directory is read-only. In dev it defaults to the repo root.
const DATA_ROOT = process.env.DATA_DIR || path.join(__dirname, '..');

// Root directory where client folders live
const CLIENTS_DIR = path.join(DATA_ROOT, 'clients');
if (!fs.existsSync(CLIENTS_DIR)) fs.mkdirSync(CLIENTS_DIR, { recursive: true });

// ── Path safety ────────────────────────────────────────────────────────────
// Every route segment that comes from the URL (:id, :filename) is attacker-
// controllable. Resolve the final path and confirm it stays inside `base`,
// otherwise a value like "..%2f..%2fsettings.json" escapes the data dir.
function safeJoin(base, ...parts) {
  const root = path.resolve(base);
  const target = path.resolve(base, ...parts);
  if (target !== root && !target.startsWith(root + path.sep)) {
    const err = new Error('Invalid path');
    err.status = 400;
    throw err;
  }
  return target;
}

// Wraps a handler so thrown errors (sync or async) become JSON responses
// instead of crashing the process or hanging the request.
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (res.headersSent) { res.end(); return; }
    res.status(err.status || 500).json({ error: err.message });
  }
};

function getAnthropicClient() {
  const settings = loadSettings();
  const apiKey = settings.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('No API key configured. Please add one in Settings.');
    err.status = 400;
    throw err;
  }
  return new Anthropic({ apiKey });
}

// ── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_PATH = path.join(DATA_ROOT, 'settings.json');

function loadSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  if (raw.apiKeyEnc && safeStorage?.isEncryptionAvailable?.()) {
    try {
      raw.apiKey = safeStorage.decryptString(Buffer.from(raw.apiKeyEnc, 'base64'));
    } catch { /* corrupt or different machine — treat as unset */ }
  }
  return raw;
}

function persistApiKey(settings, apiKey) {
  if (safeStorage?.isEncryptionAvailable?.()) {
    settings.apiKeyEnc = safeStorage.encryptString(apiKey).toString('base64');
    delete settings.apiKey;
  } else {
    // ponytail: dev-only plaintext fallback; packaged app always encrypts.
    settings.apiKey = apiKey;
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

app.get('/api/settings', wrap((req, res) => {
  const settings = loadSettings();
  res.json({ apiKey: settings.apiKey ? '••••••••' + settings.apiKey.slice(-4) : '' });
}));

app.post('/api/settings', wrap((req, res) => {
  const settings = loadSettings();
  delete settings.apiKey; // never keep a plaintext copy alongside the encrypted one
  if (req.body.apiKey) persistApiKey(settings, req.body.apiKey);
  else fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  res.json({ success: true });
}));

// ── Client CRUD ──────────────────────────────────────────────────────────────

app.get('/api/clients', wrap((req, res) => {
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
}));

app.get('/api/clients/:id/profile', wrap((req, res) => {
  const profilePath = safeJoin(CLIENTS_DIR, req.params.id, 'profile.json');
  if (!fs.existsSync(profilePath)) return res.status(404).json({ error: 'Not found' });
  res.json(JSON.parse(fs.readFileSync(profilePath, 'utf8')));
}));

app.post('/api/clients', wrap((req, res) => {
  const { name, dateOfBirth, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Client name is required.' });
  }
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const id = (slug || 'client') + '-' + Date.now();
  const clientDir = safeJoin(CLIENTS_DIR, id);
  fs.mkdirSync(clientDir);
  const profile = { id, name, dateOfBirth, notes, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(clientDir, 'profile.json'), JSON.stringify(profile, null, 2));
  fs.writeFileSync(path.join(clientDir, 'chat_history.json'), JSON.stringify([], null, 2));
  res.json(profile);
}));

app.put('/api/clients/:id/profile', wrap((req, res) => {
  const profilePath = safeJoin(CLIENTS_DIR, req.params.id, 'profile.json');
  if (!fs.existsSync(profilePath)) return res.status(404).json({ error: 'Not found' });
  const updated = { ...JSON.parse(fs.readFileSync(profilePath, 'utf8')), ...req.body };
  fs.writeFileSync(profilePath, JSON.stringify(updated, null, 2));
  res.json(updated);
}));

app.delete('/api/clients/:id', wrap((req, res) => {
  const clientDir = safeJoin(CLIENTS_DIR, req.params.id);
  if (!fs.existsSync(clientDir)) return res.status(404).json({ error: 'Not found' });
  fs.rmSync(clientDir, { recursive: true });
  res.json({ success: true });
}));

// ── File uploads ──────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const filesDir = safeJoin(CLIENTS_DIR, req.params.id, 'files');
      if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
      cb(null, filesDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Strip any path components from the client-supplied name, then prefix with
    // a timestamp to avoid collisions.
    const safe = path.basename(file.originalname).replace(/[/\\]/g, '');
    cb(null, Date.now() + '-' + safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB

app.post('/api/clients/:id/files', upload.single('file'), wrap((req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
}));

app.get('/api/clients/:id/files', wrap((req, res) => {
  const filesDir = safeJoin(CLIENTS_DIR, req.params.id, 'files');
  if (!fs.existsSync(filesDir)) return res.json([]);
  const files = fs.readdirSync(filesDir).map((f) => {
    const stat = fs.statSync(path.join(filesDir, f));
    const originalName = f.replace(/^\d+-/, '');
    return { filename: f, originalName, size: stat.size };
  });
  res.json(files);
}));

app.get('/api/clients/:id/files/:filename/serve', wrap((req, res) => {
  const filePath = safeJoin(CLIENTS_DIR, req.params.id, 'files', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  // Files are served same-origin as the API with no auth, so an uploaded HTML/SVG
  // file could otherwise run as stored XSS against the backend. Block sniffing and
  // force active types to download rather than execute.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const ext = path.extname(filePath).toLowerCase();
  if (['.html', '.htm', '.svg', '.xml'].includes(ext)) {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
  }
  res.sendFile(filePath);
}));

app.delete('/api/clients/:id/files/:filename', wrap((req, res) => {
  const filePath = safeJoin(CLIENTS_DIR, req.params.id, 'files', req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
}));

// ── Chat history ──────────────────────────────────────────────────────────────

app.get('/api/clients/:id/chat', wrap((req, res) => {
  const chatPath = safeJoin(CLIENTS_DIR, req.params.id, 'chat_history.json');
  if (!fs.existsSync(chatPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(chatPath, 'utf8')));
}));

// ── Anthropic proxy ───────────────────────────────────────────────────────────

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function buildFileContentBlock(filePath, mimetype) {
  if (mimetype.startsWith('text/') || mimetype === 'application/json') {
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

app.post('/api/clients/:id/chat', wrap(async (req, res) => {
  const { message, attachments = [] } = req.body;
  const clientId = req.params.id;

  const profilePath = safeJoin(CLIENTS_DIR, clientId, 'profile.json');
  const chatPath = safeJoin(CLIENTS_DIR, clientId, 'chat_history.json');

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
  for (const att of attachments) {
    const filePath = safeJoin(CLIENTS_DIR, clientId, 'files', att.filename);
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

  // getAnthropicClient throws before any streaming headers are sent, so a
  // missing key still returns a clean 400 JSON error.
  const anthropic = getAnthropicClient();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let assistantMessage = '';
  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });
    stream.on('text', (delta) => {
      assistantMessage += delta;
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    });
    await stream.finalMessage();
  } catch (err) {
    console.error('Anthropic error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    return res.end();
  }

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

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
}));

app.delete('/api/clients/:id/chat', wrap((req, res) => {
  const chatPath = safeJoin(CLIENTS_DIR, req.params.id, 'chat_history.json');
  fs.writeFileSync(chatPath, JSON.stringify([], null, 2));
  res.json({ success: true });
}));

const FRONTEND_BUILD = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(FRONTEND_BUILD)) {
  app.use(express.static(FRONTEND_BUILD));
  app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_BUILD, 'index.html')));
}

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
