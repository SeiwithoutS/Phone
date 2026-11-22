# EPhone

EPhone is a local, mobile-first character chat app. It runs in your browser with a local Node.js server. The interface uses React, TypeScript, React Router, and Tailwind CSS. Terminology such as **World Info**, **Character Card**, and **Chat Completion** follows SillyTavern.

## Windows

1. Install Node.js 22 or later.
2. Open `start.bat` from the project folder. It installs dependencies, builds the frontend, and starts the server.
3. Open <http://127.0.0.1:8000> in your browser.

## Android with Termux

Clone the **EPhone** repository into Termux's home directory. Replace `<eephone-repository-url>` with the Git URL where you save this project.

```bash
pkg update
pkg install git nodejs-lts
cd ~
git clone <eephone-repository-url> eephone
cd eephone
bash start.sh
```

Open <http://127.0.0.1:8000> in the phone's browser. Leave the Termux session running while using EPhone. After an initial build, `npm start` starts the server using the existing build without reinstalling dependencies.

The server listens on the device's loopback address. To use another port, set `PORT` before launch, for example `PORT=8017 npm start` in Termux or `$env:PORT = '8017'; npm start` in PowerShell.

## Local data and backup

- The server creates `data/eephone.json` in the project folder on the first write. Set `EEPHONE_DATA_DIR` to use another data folder.
- Chats, personas, World Info, preferences, API configuration, and local media are saved to disk. Reloading the browser or restarting the server preserves that file.
- Use **API Connections → Export Data** for a backup and **Import Backup** to restore it. Use these options to transfer data from the original browser-only EPhone or between devices. The new backup includes saved API keys.
- The server can import the old browser database automatically on its first run when the old and new EPhone use the same browser origin. If the URL or port changed, use a JSON backup from the original app.
- Configure your own AI providers in **API Connections**. You can enter a model ID directly or use **Fetch Models**. External AI, music, and remote images still need access to their respective services.

## Development

EPhone uses strict TypeScript for the React UI, routing, storage API, and Node server. React screens and related dialogs live in feature folders. Existing DOM-based JavaScript is grouped by feature in `src/legacy/`.

Read [the project conventions](CONTRIBUTING.md) for the directory map, component contracts, styling rules, and how to migrate a feature.

Run `npm ci` once, then `npm run dev` for development. Use `npm run typecheck`, `npm test`, and `npm run build` to verify changes. The production build writes the frontend into `dist/` and the compiled server into `build/server/`.
