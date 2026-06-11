# Client File System

An AI-powered desktop app for managing client files and folders, built with Electron, React, and the Anthropic Claude API.

## Features

- Organize clients into individual folders with profile metadata
- Upload and manage files per client
- AI-powered file analysis and chat using Claude
- Settings UI for managing your Anthropic API key
- Packaged as a native Windows desktop app

## Tech Stack

- **Frontend:** React
- **Backend:** Node.js + Express
- **Desktop shell:** Electron
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`)

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- An [Anthropic API key](https://console.anthropic.com/)

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/Braoden/ClientFileSystem.git
   cd ClientFileSystem
   ```

2. Install root dependencies:
   ```bash
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend && npm install && cd ..
   ```

4. Install backend dependencies:
   ```bash
   cd backend && npm install && cd ..
   ```

5. Create a `.env` file in the project root (optional — you can also set the key in the app's Settings screen):
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

6. Start the app in development mode:
   ```bash
   npm start
   ```

## Building a Distributable

```bash
npm run dist
```

The installer will be output to the `dist/` directory.

## License

MIT — see [LICENSE](LICENSE) for details.
