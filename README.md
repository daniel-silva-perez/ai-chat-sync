# AI Chat Sync

Local-first userscript that syncs AI conversations across ChatGPT, Claude, and Gemini without a backend or external API keys.

## What It Does

- Saves conversation history locally through userscript storage
- Surfaces synced chats inside supported AI-product sidebars
- Opens foreign chats in a native-feeling overlay
- Helps continue a synced conversation by carrying context into a new native chat
- Keeps data on the user's machine instead of routing it through a service

## Why It Matters

AI workflows often fragment across products. This project treats portability as a browser integration problem: different DOMs, different sidebars, different interaction models, and a strong local-first privacy constraint.

## Supported Platforms

- ChatGPT
- Claude
- Gemini

## Installation

1. Install a userscript manager such as Tampermonkey.
2. Create a new script.
3. Paste in `ai_chat_sync.user.js`.
4. Visit a supported AI assistant.

## Recruiter Signals

- Browser automation and UI integration
- Privacy-conscious product design
- Cross-product workflow thinking
- Single-file deployability for lightweight user tools

## License

MIT. Includes work derived from RevivalStack under MIT License.
