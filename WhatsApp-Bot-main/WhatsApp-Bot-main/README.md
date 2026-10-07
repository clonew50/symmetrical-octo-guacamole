<div align="center">

<img src="https://img.shields.io/badge/WOLFTECH-WhatsApp%20Bot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WOLFTECH"/>

# 🐺 WOLFTECH — WhatsApp Bot Framework

**A fast, modular, open-source WhatsApp bot framework for developers.**  
Build your own feature-rich WhatsApp bot in minutes — no experience required.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Powered%20by-Baileys-128C7E?style=flat-square)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red?style=flat-square)](https://github.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

[Features](#-features) · [Quick Start](#-quick-start) · [Commands](#-command-system) · [Contributing](#-contributing) · [Docs](#-documentation)

</div>


<img src="https://i.ibb.co/N6fVpZtL/upload-1778355377958-34f272b3-jpg.jpg" alt="WOLFTECH Banner" width="100%"/>
---

## 🌍 What Is 🐺 WOLFTECH — WhatsApp Bot Framework?

**🐺 WOLFTECH — WhatsApp Bot Framework** is a free, open-source WhatsApp bot framework built on top of [Baileys](https://github.com/WhiskeySockets/Baileys) — the most popular unofficial WhatsApp Web API library for Node.js. It gives developers a clean, well-structured starting point to build their own WhatsApp bots without dealing with the complexity of raw WebSocket connections, session management, or message parsing.

Whether you want to build a **group management bot**, a **customer support bot**, an **automation tool**, or just learn how WhatsApp bots work under the hood — WOLFTECH gives you the foundation.

> 🎯 **Built for developers by developers.** Fork it, extend it, make it yours.

---

## ✨ Features

- 🔌 **Plug-and-play command system** — drop a `.js` file into the `commands/` folder and it's live
- 📁 **Auto command loader** — scans all subfolders and registers commands automatically at startup
- 🔐 **Pairing code & Session ID login** — no QR code scanning needed
- 👑 **Owner/JID management** — smart JID resolution including `@lid` (linked devices)
- 🛡️ **Rate limit protection** — built-in cooldown system to prevent spam abuse
- 👥 **Group event detection** — detects new members joining groups in real time
- 👁️ **Status watcher** — auto-view and auto-react to WhatsApp statuses
- 🔄 **Auto-reconnect** — exponential backoff reconnection on disconnect
- 🌐 **Multi-platform** — runs on Local/VPS, Heroku, Render, Replit, Railway, and more
- 📋 **Live message logging** — colour-coded terminal logs for every incoming DM and group message
- 🤖 **Public/Private/Group-only modes** — control who can use your bot
- 💬 **Prefixed & prefixless modes** — supports both `.command` and raw `command` styles
- 🧩 **Category-based commands** — organise commands into folders by category automatically

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ (ESM) |
| WhatsApp API | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) |
| Terminal UI | [chalk](https://github.com/chalk/chalk) |
| Environment | [dotenv](https://github.com/motdotla/dotenv) |
| Module system | ES Modules (`import`/`export`) |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) **v18 or higher**
- A WhatsApp account (personal or dedicated bot number)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/wolftech-bot.git
cd wolftech-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
BOT_NAME=WOLFTECH
PREFIX=.
```

### 4. Start the bot

```bash
node index.js
```

On first run you will see the login menu:

```
🐺 WOLFTECH v1.1.3 - LOGIN SYSTEM
1) Pairing Code Login (Recommended)
2) Clean Session & Start Fresh
3) Use Session ID from Environment
```

Choose **option 1**, enter your phone number (with country code, no `+`), then enter the pairing code shown in your WhatsApp under **Settings → Linked Devices → Link a Device**.

---

## 🗂️ Project Structure

```
wolftech-bot/
├── index.js                  # Main entry point — bot core
├── .env                      # Environment variables
├── .env.example              # Environment variable template
├── owner.json                # Auto-generated — stores owner JID
├── prefix_config.json        # Auto-generated — stores current prefix
│
├── commands/                 # 📁 All commands live here
│   ├── general/              # General-purpose commands
│   │   ├── ping.js
│   │   └── help.js
│   ├── group/                # Group management commands
│   │   ├── ban.js
│   │   ├── add.js
│   │   └── antidemote.js
│   ├── automation/           # Automation commands
│   │   ├── autoreactstatus.js
│   │   └── autoviewstatus.js
│   └── utility/              # Utility commands
│       └── getjid.js
│
├── lib/                      # Shared helpers/utilities
│   └── menuHelper.js
│
├── data/                     # Auto-generated runtime data
│   ├── welcome_data.json
│   └── member_detection.json
│
└── session/                  # Auto-generated — Baileys session files
```

---

## ⚙️ Command System

This is the heart of WOLFTECH. The entire command system is designed so that **adding a new command is as simple as creating a new file**.

### How command loading works

When the bot starts, `loadCommandsFromFolder('./commands')` is called. It:

1. Recursively scans every subfolder inside `commands/`
2. Imports every `.js` file it finds (skipping `.test.js` and `.disabled.js` files)
3. Reads the `name`, `alias`, and `category` from each exported module
4. Registers the command into a global `Map` so it can be looked up in milliseconds
5. Groups commands by their folder name (subfolder = category) for the `help` command

This means **you never have to register a command manually**. Just create the file.

### Command file structure

Every command is a single `.js` file with a default export:

```js
// commands/general/ping.js

export default {
  name: 'ping',                    // command name (how users call it)
  description: 'Check bot speed',  // shown in help menu
  category: 'general',             // auto-set from folder name
  aliases: ['p', 'test'],          // alternative names users can type
  ownerOnly: false,                 // set true to restrict to bot owner

  async execute(sock, msg, args, prefix, context) {
    const chatId = msg.key.remoteJid;

    await sock.sendMessage(chatId, {
      text: `🏓 Pong! Bot is alive.`
    }, { quoted: msg });
  }
};
```

### The `context` object

Every command receives a `context` object as the 5th argument, giving you access to the entire bot state without importing anything:

```js
async execute(sock, msg, args, prefix, context) {
  const {
    OWNER_NUMBER,      // owner's phone number
    OWNER_JID,         // owner's WhatsApp JID
    BOT_NAME,          // bot name from .env
    VERSION,           // bot version string
    isOwner,           // function — call isOwner() → true/false
    jidManager,        // JID resolution & owner management class
    store,             // in-memory message store
    statusDetector,    // status watcher instance
    updatePrefix,      // function to change the prefix live
    getCurrentPrefix,  // function to get the current prefix
    rateLimiter,       // rate limit protection instance
    memberDetector,    // group member detection instance
    isPrefixless,      // boolean — true if bot is in prefixless mode
  } = context;
}
```

### Creating a category

Just create a new subfolder inside `commands/`. It becomes a category automatically:

```
commands/
└── myfeature/
    ├── mycommand.js      # category = 'myfeature'
    └── anothercommand.js
```

### Restricting a command to the owner

```js
export default {
  name: 'restart',
  ownerOnly: true,   // ← non-owners get a rejection message automatically
  async execute(sock, msg, args, prefix, context) {
    // only the bot owner reaches this code
  }
};
```

### Disabling a command without deleting it

Rename the file to include `.disabled.`:

```
commands/general/ping.disabled.js   ← skipped by the loader
```

---

## 🔐 Authentication

WOLFTECH supports two login methods:

### Method 1 — Pairing Code (Recommended)

No QR code. Enter your phone number and WhatsApp gives you an 8-digit code to type in the app under **Settings → Linked Devices**.

### Method 2 — Session ID

If you've previously generated a session, export it as a base64 string or `WOLF-BOT:...` prefixed string and set it in your environment:

```env
SESSION_ID=WOLF-BOT:eyJub2lzZUtleS...
```

The bot will authenticate automatically without any prompts — perfect for cloud deployments.

---

## 🤖 JID Resolution

WhatsApp JIDs (Jabber IDs) are the unique identifiers for every user, group, and channel. WOLFTECH handles all JID types correctly:

| JID Type | Example | Meaning |
|---|---|---|
| `@s.whatsapp.net` | `254712345678@s.whatsapp.net` | Regular user |
| `@g.us` | `120363xxxxxx@g.us` | Group chat |
| `@lid` | `12345:67@lid` | Linked/companion device |
| `@newsletter` | `xxx@newsletter` | WhatsApp Channel |

`@lid` JIDs are companion device identifiers that don't contain a phone number. WOLFTECH resolves them back to real phone JIDs using a 4-step fallback chain:

1. Group participant metadata (has `phoneNumber` on some builds)
2. Baileys signal repository LID→PN mapping
3. Global `lidPhoneCache` if populated
4. `sock.store.contacts` lookup

---

## 🖥️ Terminal Logging

Every incoming message is printed in a structured, colour-coded log:

**DM (green):**
```
╭─────────────────────────────────────
│ 🐺 WOLFTECH LOG #12
├─────────────────────────────────────
│ 👤 Name   : Silent Wolf
│ ☎️  Number : +254785471416
│ 🆔 JID    : 254785471416@s.whatsapp.net
│ 💬 Msg    : .menu
│ 🕒 Time   : 18:42:11
│ 📩 Type   : DM
╰─────────────────────────────────────
```

**Group message (green):**
```
╭──────────────────────────────────────────
│ 🐺 WOLFTECH LOG #13
├──────────────────────────────────────────
│ 👥 Group  : Wolf Empire
│ 👤 Sender : Silent Wolf
│ ☎️  Number : +254785471416
│ 🆔 JID    : 120363xxxxxx@g.us
│ 💬 Msg    : Hello everyone
│ 🕒 Time   : 18:44:03
│ 📩 Type   : GROUP
╰──────────────────────────────────────────
```

---

## 🌐 Deployment

### Local / VPS

```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start index.js --name wolftech

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Render / Railway / Heroku

Set these environment variables on your platform:

```env
BOT_NAME=WOLFTECH
PREFIX=.
SESSION_ID=WOLF-BOT:your_session_string_here
```

The platform is auto-detected and shown in the `.connect` command output.

---

## 🛡️ Bot Modes

Control who can use your bot at runtime:

| Mode | Behaviour |
|---|---|
| `public` | Everyone can use commands |
| `private` | Only the owner can use commands |
| `group-only` | Only works in groups |
| `maintenance` | Only `ping`, `help`, `status`, `uptime` work |
| `silent` | No responses at all (stealth mode) |

---

## 🤝 Contributing

Contributions are welcome and appreciated. Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-new-command`
3. **Write** your command in the appropriate `commands/` subfolder
4. **Test** it locally
5. **Commit** with a clear message: `git commit -m 'feat: add weather command'`
6. **Push** and open a **Pull Request**

### Contribution ideas

- New commands (games, utilities, group tools, AI integrations)
- Bug fixes and stability improvements
- Platform-specific deployment guides
- Translations / localisation
- Unit tests

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting.

---

## ❓ FAQ

**Q: Is this against WhatsApp's Terms of Service?**  
A: Using unofficial APIs carries inherent risk. Use a dedicated bot number, not your personal account. WOLFTECH is provided for educational and development purposes.

**Q: My session keeps disconnecting. What do I do?**  
A: Try option 2 (Clean Session) from the login menu, then re-pair. Persistent disconnects are usually caused by running the same session on multiple devices simultaneously.

**Q: Can I add AI / ChatGPT to my bot?**  
A: Yes — create a command that calls the OpenAI API (or any other) and sends the response back. The command system is completely flexible.

**Q: How do I run multiple bots?**  
A: Clone the repo into separate folders, give each its own `session/` directory and `.env` file, and run them as separate processes.

**Q: Does it work on Windows?**  
A: Yes. Node.js and all dependencies are cross-platform.

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

You are free to use, modify, and distribute this code for personal or commercial projects. Attribution is appreciated but not required.

---

## ⚠️ Disclaimer

WOLFTECH is an independent open-source project. It is **not affiliated with, endorsed by, or connected to WhatsApp LLC or Meta Platforms Inc.** in any way. Use responsibly and at your own risk.

---

<div align="center">

Made with ❤️ for the developer community

⭐ **Star this repo if it helped you** · 🍴 **Fork it to make it yours** · 🐛 **Open an issue if something breaks**

</div>
