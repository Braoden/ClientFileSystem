# Client File System

> A local-first desktop app that organizes clients into folders, stores their files and profile data on your machine, and lets you chat with a Claude-powered assistant that already knows everything about the client you've selected.

Built for consultants, case workers, advisors, or anyone who keeps per-client records and wants to ask an AI questions grounded in those specific records — without uploading anything to a third-party cloud.

![App screenshot placeholder — client list on the left, profile + file panel in the center, and the Claude chat panel on the right](docs/screenshot.png)

## Features

- **Per-client folders** — each client is a real folder on disk with a `profile.json`, a `files/` directory, and `chat_history.json`. Nothing is hidden in a database; you can open the folder and read everything.
- **Client-aware AI chat** — the selected client's full profile is injected as the system prompt, so Claude answers questions about *that* client without you repeating context.
- **File-grounded answers** — attach a client's uploaded files (text, CSV, Markdown, JSON, HTML, images, or PDFs) to a message and Claude reads them inline.
- **Your key, your data** — your Anthropic API key is stored locally and the app talks to the Claude API directly. No middleman server.
- **Native Windows desktop app** — packaged with Electron + electron-builder as a one-click `.exe` installer.

## Install (end users)

1. Download the latest `.exe` from the [Releases](../../releases) page.
2. Run the installer and follow the prompts (you can choose the install directory).
3. Launch **Client File System** from the Start Menu.
4. Open **Settings** and paste your [Anthropic API key](https://console.anthropic.com/).

## Run locally (development)

**Prerequisites:** Node.js 18+ and an Anthropic API key.

```bash
git clone <repo-url>
cd ClientFileSystem
npm install
cd frontend && npm install && cd ..
npm start
```

`npm start` runs all three processes together: the Express backend (port 3001), the React dev server (port 3000), and the Electron shell once the frontend is up.

Add your API key via the in-app **Settings** screen, or export `ANTHROPIC_API_KEY` before launching.

## Project structure

```
ClientFileSystem/
├── electron/        # Electron main + preload (spawns backend, loads frontend)
├── backend/         # Express API — clients, files, chat, Anthropic proxy
├── frontend/        # React app (dev server on :3000, built to frontend/build)
├── clients/         # Per-client data folders (created at runtime, dev only)
└── package.json     # Root scripts + electron-builder config
```

In packaged builds the backend writes client data to Electron's `userData`
directory (via `DATA_DIR`), since the install folder is read-only.

## How it works

- **Storage is the filesystem.** Creating a client makes a folder named `<slug>-<timestamp>` containing `profile.json` and an empty `chat_history.json`. Uploaded files land in `files/` prefixed with an upload timestamp. There is no database.
- **Chat is persisted on disk.** On each message the backend loads the client's profile + saved history, builds the Claude request, and appends both turns back to `chat_history.json`.
- **Files become content blocks.** Text-like files are inlined as text; images and PDFs are sent base64 as `image`/`document` blocks. Upload limit is 20 MB.
- **Model:** `claude-sonnet-4-6`, `max_tokens: 1024`.

## API reference

The backend runs on `http://localhost:3001`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/settings` | Get masked API key |
| POST | `/api/settings` | Save API key |
| GET | `/api/clients` | List all clients (id + profile) |
| POST | `/api/clients` | Create a client (`name`, `dateOfBirth`, `notes`) |
| GET | `/api/clients/:id/profile` | Get one client's profile |
| PUT | `/api/clients/:id/profile` | Update a profile |
| DELETE | `/api/clients/:id` | Delete a client folder |
| POST | `/api/clients/:id/files` | Upload a file (multipart, ≤20 MB) |
| GET | `/api/clients/:id/files` | List a client's files |
| GET | `/api/clients/:id/files/:filename/serve` | Download/serve a file |
| DELETE | `/api/clients/:id/files/:filename` | Delete a file |
| GET | `/api/clients/:id/chat` | Get chat history |
| POST | `/api/clients/:id/chat` | Send a message (`message`, `attachments[]`) |
| DELETE | `/api/clients/:id/chat` | Clear chat history |

## Tech stack

- **Desktop shell:** Electron
- **Frontend:** React
- **Backend:** Node.js + Express, Multer (uploads)
- **AI:** Anthropic Claude API via `@anthropic-ai/sdk`