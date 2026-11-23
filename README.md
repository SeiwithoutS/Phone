# EPhone

EPhone is a local, mobile-first character chat app. It runs in your browser with a local Node.js server. The interface uses React, TypeScript, React Router, and Tailwind CSS. Terminology such as **World Info**, **Character Card**, and **Chat Completion** follows SillyTavern.

## Windows

1. Install Node.js 22 or later.
2. Run `.\start.bat` in PowerShell from the project folder, or double-click `start.bat`. It installs missing dependencies, builds the frontend, and starts the server.
3. Leave the terminal open and open the address it prints. The default is <http://127.0.0.1:8000>. The configured hostname <http://eephone.localhost:8000> is also available when the browser resolves it.

## Android with Termux

Copy the EPhone source ZIP to Downloads on your phone. Extract it into the Termux home directory so the `eephone` folder can run locally.

```bash
pkg update
pkg install unzip nodejs-lts
termux-setup-storage
cd ~
unzip ~/storage/downloads/eephone-react-source.zip
cd eephone
bash start.sh
```

Open <http://127.0.0.1:8000> in the phone's browser and leave Termux running. The URL always points to the device where you open it. To run EPhone locally on the phone, start it in Termux on that phone.

### Startup troubleshooting

| What you see | What to do |
| --- | --- |
| `EPERM` or `EBUSY` during npm install | Close any EPhone or Vite terminals using that project folder, then run the launcher again. To reinstall, use `.\start.bat --install` on Windows or `bash start.sh --install` in Termux. |
| Port `8000` is already in use | Stop the other server, or run `$env:PORT='8017'; .\start.bat` in PowerShell or `PORT=8017 bash start.sh` in Termux. Open the new address printed in the terminal. |
| A custom hostname does not open | Open `http://127.0.0.1:<port>` on the device running EPhone. |
| The page says the storage API is missing | Start EPhone using the launcher and use its printed address. EPhone needs the Node server to read and save data. |

`npm start` builds on the first run and serves the existing build on later runs. To apply source changes, run the launcher again, use `npm start -- --build`, or develop with `npm run dev`. See [Đổi host và avatar](HOST-VA-AVATAR.md) for hostname, port, and site image settings.

## Home screen and apps

- Swipe left or right to change home pages. Use the dots above the dock to jump between pages. Forms, feeds, and chats scroll inside their apps.
- Open **Widgets** to add or edit a widget. Choose a template, width and shape. You can also paste CSS or import a `.css` file.
- Hold an app or widget to arrange the home screen, or tap **Arrange**. Drag to reorder, or select an item, open a page and tap **Move to this page**. The dock holds up to four apps.
- Use **Edit** to create a character or import a SillyTavern PNG, JSON, or CHARX card. **Avatar Gallery** rotates the QQ avatar by time or by connected call count. In QQ, **Chats** opens the history and lets you choose a greeting when starting a new chat.
- **Mini Prompts** stores prompts you can attach to chats. **World Info** manages lorebook entries and their activation keywords. Embedded card lorebooks appear here after you save the character.
- **Social** offers a local timeline, editable profile, image posts, replies, likes, reposts, bookmarks and search. **Auto AI comment** is off by default. Turn it on and select a character to request one automatic AI comment per new post using your configured API.

## Local data and backup

- The server creates `data/eephone.json` in the project folder on the first write. Set `EEPHONE_DATA_DIR` to use another data folder.
- Chats, personas, World Info, preferences, API configuration, and local media are saved to disk. Reloading the browser or restarting the server preserves that file.
- Use **API Connections → Export User Data ZIP**. To restore it, close the app and stop EPhone, extract `eephone.json` to the local data folder, then restart. See [Hướng dẫn sao lưu và khôi phục](HUONG-DAN-SAO-LUU.md).
- EPhone can migrate the earlier browser database on its first run if both versions use the same browser origin. The **Data maintenance** section also supports legacy JSON backups.
- Configure your own AI providers in **API Connections**. You can enter a model ID directly or use **Fetch Models**. External AI, music, and remote images still need access to their respective services.

## Development

EPhone uses strict TypeScript for the React UI, routing, storage API, and Node server. React screens and related dialogs live in feature folders. Existing DOM-based JavaScript is grouped by feature in `src/legacy/`.

Read [Cấu trúc dự án](README-CAU-TRUC.md) for a directory map and [the project conventions](CONTRIBUTING.md) for component contracts, styling rules, and how to migrate a feature.

Run `npm ci` once, then `npm run dev` for development. Use `npm run typecheck`, `npm test`, and `npm run build` to verify changes. The production build writes the frontend into `dist/` and the compiled server into `build/server/`.
