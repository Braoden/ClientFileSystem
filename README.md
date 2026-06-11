# Client File System

A folder-based client management system that organizes and stores client information, then feeds that data to a Claude-powered AI chatbot. The chatbot uses the stored client details as context to answer questions or assist with tasks related to each specific client.

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

## Installation

1. Go to the [Releases](../../releases) page and download the latest `.exe` installer.
2. Run the installer and follow the on-screen prompts.
3. Launch **Client File System** from the Start Menu or desktop shortcut.
4. On first launch, open **Settings** and enter your [Anthropic API key](https://console.anthropic.com/).

## License

MIT — see [LICENSE](LICENSE) for details.
