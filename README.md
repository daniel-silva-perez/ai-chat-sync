# AI Chat Sync

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-181717?logo=github&logoColor=white)](https://github.com/daniel-silva-perez/ai-chat-sync)
[![GitLab Repo](https://img.shields.io/badge/GitLab-Repo-FC6D26?logo=gitlab&logoColor=white)](https://gitlab.com/danielsilvaperez/ai-chat-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Sync your AI conversations across ChatGPT, Claude, and Gemini seamlessly.

AI Chat Sync is a lightweight userscript that injects your conversation history from one AI provider directly into the native sidebar of another. It allows you to view foreign chats in an overlay that matches the host's native UI and continue those conversations with full historical context.

## 🚀 Features

- **Native Sidebar Integration**: Synced chats appear directly in the sidebar of ChatGPT, Claude, and Gemini.
- **Aesthetic Platform Badges**: Each synced chat is marked with a beautiful, platform-specific gradient badge and icon.
- **Native-Themed Overlay**: View chats from other providers in a high-fidelity overlay that mimics the host platform's design (Dark mode for ChatGPT, warm cream for Claude, clean white for Gemini).
- **Contextual Continuation**: Continue any synced chat. The script automatically creates a new native chat and pastes the context for you to review before sending.
- **Privacy First**: All data is stored locally in your browser using userscript storage. No external servers or API keys are required.

## 🛠 Installation

1. Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new script and paste the contents of `ai_chat_sync.user.js`.
3. Save and visit [ChatGPT](https://chatgpt.com), [Claude](https://claude.ai), or [Gemini](https://gemini.google.com).

## 💡 How to Use

1. **Sync**: Simply browse your chats as you normally would. The script automatically saves them to your local storage.
2. **Navigate**: Switch to a different AI provider.
3. **View**: Look at the "Synced Chats" section in the native sidebar.
4. **Continue**: Click a synced chat to open the overlay. Type a message and hit the send button. The script will move you to a new native chat and paste the context for your final review.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Credits

Includes work derived from [revivalstack](https://github.com/revivalstack) (MIT License 2025).
