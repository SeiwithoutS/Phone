# EPhone

EPhone is a local, mobile-first character chat app. It runs in your browser with a local Node.js server. The interface uses React, TypeScript, React Router, and Tailwind CSS. Terminology such as **World Info**, **Character Card**, and **Chat Completion** follows SillyTavern.

## Windows

1. Install Node.js 22 or later.
2. Run `.\start.bat` in PowerShell from the project folder, or double-click `start.bat`. It installs missing dependencies, builds the frontend, and starts the server.
3. Leave the terminal open and open the address it prints. The default is <http://127.0.0.1:8017>. The configured hostname <http://eephone.localhost:8017> is also available when the browser resolves it.

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

Open <http://127.0.0.1:8017> in the phone's browser and leave Termux running. The URL always points to the device where you open it. To run EPhone locally on the phone, start it in Termux on that phone.

See [Updating EPhone](#updating-ephone) when a new version is available.

### Startup troubleshooting

| What you see | What to do |
| --- | --- |
| `EPERM` or `EBUSY` during npm install | Close any EPhone or Vite terminals using that project folder, then run the launcher again. To reinstall, use `.\start.bat --install` on Windows or `bash start.sh --install` in Termux. |
| Port `8017` is already in use | Stop the other server, or run `$env:PORT='8018'; .\start.bat` in PowerShell or `PORT=8018 bash start.sh` in Termux. Open the new address printed in the terminal. |
| A custom hostname does not open | Open `http://127.0.0.1:<port>` on the device running EPhone. |
| The page says the storage API is missing | Start EPhone using the launcher and use its printed address. EPhone needs the Node server to read and save data. |

## Updating EPhone

Before updating, save open edits, export a full ZIP from **Backup**, and stop the server with **Ctrl+C**. Your local data is stored in `data/eephone.json` or in the directory configured by `EEPHONE_DATA_DIR`.

### Termux with a Git clone

Install Git once with `pkg install git`. When a new version is published to your clone's tracked branch, run these commands. Replace `~/eephone` with your clone's folder if it has a different name.

```bash
cd ~/eephone &&
git pull --ff-only &&
bash start.sh
```

`git pull --ff-only` updates the source from the tracked branch. The default `data/` directory is excluded from Git, so the pull leaves your chats and settings in place. `bash start.sh` checks dependencies, rebuilds, and starts the server. If Git stops because of local edits or divergent history, run `git status` and resolve the reported issue before retrying.

### Termux with a source ZIP

A folder extracted from the source ZIP has no Git checkout. You can extract each new ZIP into a fresh folder and copy the existing `data/` folder into it before starting. To switch to Git updates, clone this branch into a new folder once. The commands below use the default ZIP installation and data paths.

```bash
pkg install git &&
cd ~ &&
git clone --branch THuong https://github.com/SeiwithoutS/Phone.git eephone-git &&
if [ -z "${EEPHONE_DATA_DIR:-}" ] && [ -d ~/eephone/data ]; then
  cp -a ~/eephone/data ~/eephone-git/
fi &&
cd ~/eephone-git &&
bash start.sh
```

The copy runs only when the default data folder exists and `EEPHONE_DATA_DIR` is unset. If you use a custom data folder, keep the same absolute `EEPHONE_DATA_DIR` when starting the new checkout. For subsequent Git updates, use `~/eephone-git` in the previous section.

### Windows and verification

For a Git checkout on Windows, run `git pull --ff-only` in the project folder, then run `.\start.bat` after the pull succeeds. For a source ZIP, extract the update into a fresh folder and copy the existing data directory or restore your backup there.

After starting the updated app, reload the address printed in the terminal and open an existing chat to confirm that your data is present.

`npm start` builds on the first run and serves the existing build on later runs. Use the rebuild step for source and storage changes. If dependency installation needs a reset, run `.\start.bat --install` or `bash start.sh --install`. Set `EEPHONE_HOST` or `PORT` to change the local address.

Replace `public/site-avatar.jpg` and rebuild to change the site icon.

## Home screen and apps

- Swipe left or right to change home pages. Use the dots above the dock to jump between pages. Forms, feeds, and chats scroll inside their apps.
- Open **Widgets** to add or edit a widget. Choose a template, width and shape. You can also paste CSS or import a `.css` file.
- Hold an app or widget to arrange the home screen, or tap **Arrange**. Drag to reorder, or select an item, open a page and tap **Move to this page**. The dock holds up to four apps.
- Use the sun or moon icon on Home or Social to switch the app between light and dark mode. The choice is saved with your local data.
- Use **Edit** to create a character or import a SillyTavern PNG, JSON, or CHARX card. **Avatar Gallery** rotates the QQ avatar by time or by connected call count.
- In QQ, open **Chat actions** to manage chat files, regenerate the latest reply, or select messages to delete on the chat screen. Open a bubble's **⋯** menu to edit or branch. The Swipe controls are on the user message that prompted the reply. For openings and proactive replies, the first AI bubble carries the controls. Regen and Swipe work on a complete AI turn.
- **QQ → Chat Settings → Setup → Location and time zone** keeps character and user cities separate. Choose a time zone manually or use Automatic, which recognizes common city names and falls back to the device zone. **QQ → Personas** stores the user city and time zone with each persona. Applying a persona copies those values into the selected chat. The default persona supplies them to new private chats.
- **Linked World Info** activates enabled lorebook entries by keyword or Always On. **Linked Mini Prompts** includes enabled entries from the selected Mini Prompt books. Both links are selected independently in **Chat Settings → Setup**.
- Choose a per-chat **Preset** in **Chat Settings** for Offline Mode, or choose a shared preset in **Context**. A shared selection takes precedence while enabled. Imported SillyTavern presets can order entries and include slots for lore and chat history. Offline Mode uses the configured AI provider.
- **Context → Reply Rules** edits message range and writing style for private online Gen, Regen, and new Swipe versions. The default is 3–10 short messages. **Last sent** shows the recorded request in the current browser session.
- **QQ → Chat Settings → Diary** opens the character's diary. The **Diary CSS** panel accepts a `.css` file or pasted styles for that character.
- **Social** offers a local timeline, editable profile, photo posts, replies, likes, reposts, bookmarks and search. Use the plus icon to compose a post with up to four photos. In **Social settings**, you can enable **Auto AI comment** and choose which character or NPC replies using your configured API.
- **Marketplace** records purchases under **Orders**. Open an order to see its estimated arrival and simulated delivery timeline. Choose a chat at checkout to send a gift card immediately, send it later by hand, or schedule it to appear in chat on delivery. Automatic delivery is checked while EPhone is open and catches up the next time it opens.
- With **QQ → Chat Settings → Features → Shopping** enabled, a character can order a catalog item or submit a new item with a name, unit price, category, and description. Marketplace adds the new item when the order and Bank charge succeed. Matching catalog items keep their saved price.
- See [Hướng dẫn tùy chỉnh CSS](HUONG-DAN-CSS.md) for widget imports and selectors for chat and other screens.

## Local data and backup

- The server creates `data/eephone.json` in the project folder on the first write. Set `EEPHONE_DATA_DIR` to use another data folder.
- Chats, personas, World Info, preferences, API configuration, and local media are saved to disk. Reloading the browser or restarting the server preserves that file.
- Open **Backup** and use the export icon to export a full or selective ZIP. Restore a selected set using the import icon in **Backup**. For a full replacement, stop EPhone, extract `eephone.json` to the local data folder, then restart.
- EPhone can migrate the earlier browser database on its first run if both versions use the same browser origin. The **Data maintenance** section also supports legacy JSON backups.
- Configure your own AI providers in **API Connections**. You can enter a model ID directly or use **Fetch Models**. External AI, music, and remote images still need access to their respective services.

## Repository structure

- [`index.html`](index.html) provides the HTML entry point and [`src/main.tsx`](src/main.tsx) mounts React and the router.
- [`src/`](src/) contains the browser app.
  - [`app/`](src/app/) defines routes, composes screens and dialogs, and connects React to existing actions.
  - [`features/`](src/features/) groups React screens, dialogs, and TypeScript logic by feature.
  - [`components/`](src/components/) contains shared UI, including screen headers and icon buttons.
  - [`legacy/`](src/legacy/) contains JavaScript and CSS still used by chat, AI, and other existing workflows.
  - [`styles/`](src/styles/) contains the Tailwind entry point, theme tokens, and feature styles.
  - [`storage/`](src/storage/) and [`runtime/`](src/runtime/) provide the browser-side database layer and shared utilities.
- [`server/`](server/) serves the built app and handles local storage and backups. [`shared/storage.ts`](shared/storage.ts) defines the data format used by the browser and server.
- [`public/`](public/) holds static assets. [`scripts/`](scripts/) holds the shared launcher. [`tests/`](tests/) holds storage and compatibility tests.

For a file-by-file map and where to change specific features, see [Cấu trúc dự án](README-CAU-TRUC.md).

## Development

Run `npm ci` once, then `npm run dev` for development. Use `npm run typecheck`, `npm test`, and `npm run build` to verify changes. The production build writes the frontend into `dist/` and the compiled server into `build/server/`.

When changing chat or prompt code, link a lorebook and a Mini Prompt, choose a preset, then send a test message and inspect **Context → Last sent**. Check roles, order, active keywords, and the final reply in QQ. When changing storage, test reload and ZIP export/restore against an isolated `EEPHONE_DATA_DIR`.
