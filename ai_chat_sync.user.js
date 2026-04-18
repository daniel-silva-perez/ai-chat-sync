// ==UserScript==
// @name         AI Chat Sync
// @namespace    https://github.com/daniel-silva-perez/ai-chat-sync
// @version      0.0.1
// @description  Sync AI chats across ChatGPT, Claude, and Gemini. Foreign chats appear in the native sidebar, render in native UI, and can be continued with full context.
// @author       Daniel Silva Perez
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/app*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    //  CONSTANTS & PLATFORM DETECTION
    // ═══════════════════════════════════════════════════════════════

    const STORAGE_KEY = 'ai_chat_sync_data';
    const SYNC_INTERVAL = 3000;
    const INJECT_INTERVAL = 2500;
    const HOSTNAME = window.location.hostname;

    const PLATFORMS = { CHATGPT: 'chatgpt', CLAUDE: 'claude', GEMINI: 'gemini' };

    const CURRENT_PLATFORM = (() => {
        if (HOSTNAME.includes('chatgpt.com') || HOSTNAME.includes('chat.openai.com')) return PLATFORMS.CHATGPT;
        if (HOSTNAME.includes('claude.ai')) return PLATFORMS.CLAUDE;
        if (HOSTNAME.includes('gemini.google.com')) return PLATFORMS.GEMINI;
        return null;
    })();

    if (!CURRENT_PLATFORM) return;

    const PLATFORM_META = {
        chatgpt: {
            name: 'ChatGPT',
            color: '#10a37f',
            gradient: 'linear-gradient(135deg, #10a37f 0%, #0d8c6d 100%)',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.28 9.37a5.93 5.93 0 0 0-.51-4.87 6 6 0 0 0-6.47-2.87A5.93 5.93 0 0 0 10.8.02a6 6 0 0 0-5.73 4.15 5.94 5.94 0 0 0-3.97 2.88 6 6 0 0 0 .74 7.03 5.93 5.93 0 0 0 .51 4.87 6 6 0 0 0 6.47 2.87 5.93 5.93 0 0 0 4.5 1.61 6 6 0 0 0 5.73-4.15 5.94 5.94 0 0 0 3.97-2.88 6 6 0 0 0-.74-7.03z" fill="currentColor"/></svg>`,
            newChatUrl: '/'
        },
        claude: {
            name: 'Claude',
            color: '#D97706',
            gradient: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            newChatUrl: '/new'
        },
        gemini: {
            name: 'Gemini',
            color: '#4285F4',
            gradient: 'linear-gradient(135deg, #4285F4 0%, #1967D2 100%)',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>`,
            newChatUrl: '/app'
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  UTILITIES
    // ═══════════════════════════════════════════════════════════════

    const Utils = {
        generateId: (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
            }
            return hash.toString(36);
        },

        getCleanUrl: () => window.location.href.split(/[?#]/)[0],

        escapeHtml: (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        debounce: (fn, ms) => {
            let timer;
            return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
        },

        showToast: (message, duration = 3500) => {
            const existing = document.querySelector('.acs-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'acs-toast';
            toast.textContent = message;
            document.body.appendChild(toast);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => toast.classList.add('acs-toast-show'));
            });
            setTimeout(() => {
                toast.classList.remove('acs-toast-show');
                setTimeout(() => toast.remove(), 350);
            }, duration);
        },

        timeAgo: (ts) => {
            const diff = Date.now() - ts;
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'just now';
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            const days = Math.floor(hrs / 24);
            if (days < 7) return `${days}d ago`;
            return new Date(ts).toLocaleDateString();
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  DATA MANAGER
    // ═══════════════════════════════════════════════════════════════

    const DataManager = {
        getSyncData: () => {
            try { return JSON.parse(GM_getValue(STORAGE_KEY, '{}')); }
            catch { return {}; }
        },

        saveChat: (chatData) => {
            const data = DataManager.getSyncData();
            const chatId = chatData.id || Utils.generateId(chatData.title || 'untitled');

            const existing = data[chatId];
            if (existing && JSON.stringify(existing.messages) === JSON.stringify(chatData.messages)) return;

            data[chatId] = {
                ...chatData,
                id: chatId,
                platform: CURRENT_PLATFORM,
                lastUpdated: Date.now()
            };
            GM_setValue(STORAGE_KEY, JSON.stringify(data));
        },

        getAllChats: () => Object.values(DataManager.getSyncData()).sort((a, b) => b.lastUpdated - a.lastUpdated),

        getForeignChats: () => DataManager.getAllChats().filter(c => c.platform !== CURRENT_PLATFORM),

        getChat: (id) => DataManager.getSyncData()[id] || null
    };

    // ═══════════════════════════════════════════════════════════════
    //  EXTRACTORS
    // ═══════════════════════════════════════════════════════════════

    const Extractors = {
        [PLATFORMS.CHATGPT]: () => {
            const articles = document.querySelectorAll("[data-testid^='conversation-turn-']");
            if (articles.length === 0) return null;

            const messages = [];
            articles.forEach(article => {
                const isUser = article.querySelector('[data-message-author-role="user"]') !== null ||
                    article.getAttribute('data-testid')?.includes('user');
                const contentTarget = article.querySelector('.markdown, .whitespace-pre-wrap') || article;
                const contentText = contentTarget.innerText.trim();
                if (contentText) {
                    messages.push({ role: isUser ? 'user' : 'assistant', content: contentText });
                }
            });
            const title = document.title.replace(' - ChatGPT', '').trim();
            return { id: Utils.getCleanUrl(), title, messages };
        },

        [PLATFORMS.CLAUDE]: () => {
            const allMessages = document.querySelectorAll('[data-testid="user-message"], .font-claude-response:not(#markdown-artifact)');
            if (allMessages.length === 0) return null;

            const messages = [];
            allMessages.forEach(item => {
                const isUser = item.getAttribute('data-testid') === 'user-message';
                const contentText = item.innerText.trim();
                if (contentText) {
                    messages.push({ role: isUser ? 'user' : 'assistant', content: contentText });
                }
            });
            const title = document.title.replace(/\s-\sClaude$/, '').trim() || 'Claude Chat';
            return { id: Utils.getCleanUrl(), title, messages };
        },

        [PLATFORMS.GEMINI]: () => {
            const items = document.querySelectorAll('user-query, model-response');
            if (items.length === 0) return null;

            const messages = [];
            items.forEach(item => {
                const isUser = item.tagName.toLowerCase() === 'user-query';
                const contentElem = isUser ? item.querySelector('div.query-content') : item.querySelector('message-content');
                if (contentElem) {
                    const contentText = contentElem.innerText.replace(/^you said\s+/i, '').trim();
                    messages.push({ role: isUser ? 'user' : 'assistant', content: contentText });
                }
            });
            const title = document.title.replace('Gemini - ', '').trim();
            return { id: Utils.getCleanUrl(), title, messages };
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  STYLES
    // ═══════════════════════════════════════════════════════════════

    const injectStyles = () => {
        GM_addStyle(`
            /* ─── Toast ─── */
            .acs-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(16px);
                background: rgba(15, 15, 15, 0.92);
                color: #f0f0f0;
                padding: 12px 28px;
                border-radius: 12px;
                font-size: 13.5px;
                font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
                z-index: 2147483647;
                opacity: 0;
                transition: opacity 0.3s ease, transform 0.3s ease;
                pointer-events: none;
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255,255,255,0.08);
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                letter-spacing: 0.01em;
            }
            .acs-toast-show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            /* ─── Sidebar Injection ─── */
            .acs-synced-section {
                padding: 6px 0 8px;
                margin-top: 2px;
            }
            .acs-synced-divider {
                height: 1px;
                margin: 4px 16px 8px;
                opacity: 0.12;
            }
            .acs-synced-label {
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 4px 16px 6px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                opacity: 0.45;
                user-select: none;
                cursor: default;
            }
            .acs-synced-label svg { opacity: 0.7; }

            .acs-sidebar-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                margin: 1px 8px;
                cursor: pointer;
                border-radius: 10px;
                text-decoration: none !important;
                transition: background 0.15s ease, box-shadow 0.15s ease;
                position: relative;
                overflow: hidden;
            }
            .acs-sidebar-item::before {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 10px;
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            .acs-sidebar-item:hover::before { opacity: 1; }

            /* Platform badge — aesthetic pill */
            .acs-badge {
                flex-shrink: 0;
                width: 26px;
                height: 26px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            .acs-sidebar-item:hover .acs-badge {
                transform: scale(1.08);
                box-shadow: 0 3px 10px rgba(0,0,0,0.25);
            }
            .acs-sidebar-item-text {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 1px;
            }
            .acs-sidebar-item-title {
                font-size: 13.5px;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.35;
            }
            .acs-sidebar-item-meta {
                font-size: 11px;
                opacity: 0.45;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            /* ─── Host-specific sidebar theming ─── */
            .acs-host-chatgpt .acs-synced-divider { background: #ffffff; }
            .acs-host-chatgpt .acs-synced-label { color: #b4b4b4; }
            .acs-host-chatgpt .acs-sidebar-item { color: #e0e0e0; }
            .acs-host-chatgpt .acs-sidebar-item::before { background: rgba(255,255,255,0.08); }
            .acs-host-chatgpt .acs-sidebar-item:hover { background: transparent; }

            .acs-host-claude .acs-synced-divider { background: #000000; }
            .acs-host-claude .acs-synced-label { color: #6b6b6b; }
            .acs-host-claude .acs-sidebar-item { color: #2d2d2d; }
            .acs-host-claude .acs-sidebar-item::before { background: rgba(0,0,0,0.04); }

            .acs-host-gemini .acs-synced-divider { background: #000000; }
            .acs-host-gemini .acs-synced-label { color: #5f6368; }
            .acs-host-gemini .acs-sidebar-item { color: #1f1f1f; }
            .acs-host-gemini .acs-sidebar-item::before { background: rgba(0,0,0,0.05); }

            /* ═══════════════════════════════════════
               CHAT OVERLAY
               ═══════════════════════════════════════ */
            .acs-overlay {
                position: fixed;
                top: 0;
                bottom: 0;
                right: 0;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                opacity: 0;
                transform: translateX(8px);
                transition: opacity 0.25s ease, transform 0.25s ease;
            }
            .acs-overlay.acs-visible {
                opacity: 1;
                transform: translateX(0);
            }

            /* Chat header */
            .acs-o-header {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 24px;
                flex-shrink: 0;
            }
            .acs-o-back {
                background: none;
                border: 1px solid rgba(128,128,128,0.2);
                border-radius: 10px;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 16px;
                transition: background 0.15s, border-color 0.15s;
                flex-shrink: 0;
            }
            .acs-o-back:hover { border-color: rgba(128,128,128,0.4); }
            .acs-o-info { flex: 1; min-width: 0; }
            .acs-o-title {
                font-size: 16px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.3;
            }
            .acs-o-source {
                font-size: 12px;
                opacity: 0.5;
                margin-top: 2px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .acs-o-source-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
                color: white;
                opacity: 0.9;
            }

            /* Messages */
            .acs-o-messages {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                scroll-behavior: smooth;
            }
            .acs-o-messages-inner {
                max-width: 800px;
                margin: 0 auto;
                padding: 12px 24px 32px;
            }
            .acs-o-msg {
                padding: 20px 0;
            }
            .acs-o-msg + .acs-o-msg {
                border-top: 1px solid rgba(128,128,128,0.08);
            }
            .acs-o-msg-role {
                font-size: 12.5px;
                font-weight: 700;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .acs-o-msg-role .acs-role-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                display: inline-block;
            }
            .acs-o-msg-content {
                font-size: 15px;
                line-height: 1.72;
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }

            /* Input bar */
            .acs-o-inputbar {
                flex-shrink: 0;
                padding: 12px 24px 20px;
            }
            .acs-o-input-wrap {
                max-width: 800px;
                margin: 0 auto;
            }
            .acs-o-input-row {
                display: flex;
                align-items: flex-end;
                gap: 10px;
                border-radius: 16px;
                padding: 6px 6px 6px 18px;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .acs-o-textarea {
                flex: 1;
                border: none;
                outline: none;
                background: transparent;
                font-size: 14.5px;
                font-family: inherit;
                resize: none;
                min-height: 24px;
                max-height: 180px;
                line-height: 1.55;
                padding: 8px 0;
            }
            .acs-o-sendbtn {
                width: 38px;
                height: 38px;
                border-radius: 12px;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: opacity 0.15s, transform 0.15s;
                color: white;
                font-size: 16px;
            }
            .acs-o-sendbtn:hover { opacity: 0.88; transform: scale(1.04); }
            .acs-o-sendbtn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
            .acs-o-hint {
                text-align: center;
                font-size: 11.5px;
                opacity: 0.4;
                margin-top: 8px;
                letter-spacing: 0.01em;
            }

            /* ═══ CHATGPT THEME ═══ */
            .acs-theme-chatgpt {
                background: #212121;
                color: #ececec;
                font-family: 'Söhne', ui-sans-serif, system-ui, -apple-system, sans-serif;
            }
            .acs-theme-chatgpt .acs-o-header { border-bottom: 1px solid rgba(255,255,255,0.06); }
            .acs-theme-chatgpt .acs-o-back { color: #ccc; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
            .acs-theme-chatgpt .acs-o-back:hover { background: rgba(255,255,255,0.1); }
            .acs-theme-chatgpt .acs-o-messages { background: #212121; }
            .acs-theme-chatgpt .acs-o-msg-user .acs-o-msg-role { color: #b0b0b0; }
            .acs-theme-chatgpt .acs-o-msg-user .acs-role-dot { background: #ececec; }
            .acs-theme-chatgpt .acs-o-msg-assistant .acs-o-msg-role { color: #10a37f; }
            .acs-theme-chatgpt .acs-o-msg-assistant .acs-role-dot { background: #10a37f; }
            .acs-theme-chatgpt .acs-o-inputbar { border-top: 1px solid rgba(255,255,255,0.06); background: #212121; }
            .acs-theme-chatgpt .acs-o-input-row { background: #303030; border: 1px solid rgba(255,255,255,0.1); }
            .acs-theme-chatgpt .acs-o-input-row:focus-within { border-color: rgba(255,255,255,0.2); box-shadow: 0 0 0 2px rgba(16,163,127,0.15); }
            .acs-theme-chatgpt .acs-o-textarea { color: #ececec; }
            .acs-theme-chatgpt .acs-o-textarea::placeholder { color: rgba(255,255,255,0.3); }
            .acs-theme-chatgpt .acs-o-sendbtn { background: #10a37f; }

            /* ═══ CLAUDE THEME ═══ */
            .acs-theme-claude {
                background: #faf8f5;
                color: #1a1a1a;
                font-family: 'Söhne', ui-sans-serif, system-ui, -apple-system, sans-serif;
            }
            .acs-theme-claude .acs-o-header { border-bottom: 1px solid rgba(0,0,0,0.06); }
            .acs-theme-claude .acs-o-back { color: #555; background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.1); }
            .acs-theme-claude .acs-o-back:hover { background: rgba(0,0,0,0.06); }
            .acs-theme-claude .acs-o-messages { background: #faf8f5; }
            .acs-theme-claude .acs-o-msg-user {
                background: #f0ece4;
                border-radius: 16px;
                padding: 18px 22px !important;
                margin: 4px 0;
            }
            .acs-theme-claude .acs-o-msg-user .acs-o-msg-role { color: #8b7355; }
            .acs-theme-claude .acs-o-msg-user .acs-role-dot { background: #8b7355; }
            .acs-theme-claude .acs-o-msg-assistant .acs-o-msg-role { color: #c2703e; }
            .acs-theme-claude .acs-o-msg-assistant .acs-role-dot { background: #c2703e; }
            .acs-theme-claude .acs-o-inputbar { border-top: 1px solid rgba(0,0,0,0.06); background: #faf8f5; }
            .acs-theme-claude .acs-o-input-row { background: #ffffff; border: 1px solid rgba(0,0,0,0.1); }
            .acs-theme-claude .acs-o-input-row:focus-within { border-color: #c2703e; box-shadow: 0 0 0 2px rgba(194,112,62,0.12); }
            .acs-theme-claude .acs-o-textarea { color: #1a1a1a; }
            .acs-theme-claude .acs-o-textarea::placeholder { color: rgba(0,0,0,0.3); }
            .acs-theme-claude .acs-o-sendbtn { background: #c2703e; }

            /* ═══ GEMINI THEME ═══ */
            .acs-theme-gemini {
                background: #ffffff;
                color: #1f1f1f;
                font-family: 'Google Sans', 'Roboto', system-ui, -apple-system, sans-serif;
            }
            .acs-theme-gemini .acs-o-header { border-bottom: 1px solid rgba(0,0,0,0.07); }
            .acs-theme-gemini .acs-o-back { color: #444; background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.1); }
            .acs-theme-gemini .acs-o-back:hover { background: rgba(0,0,0,0.06); }
            .acs-theme-gemini .acs-o-messages { background: #ffffff; }
            .acs-theme-gemini .acs-o-msg-user .acs-o-msg-role { color: #5f6368; }
            .acs-theme-gemini .acs-o-msg-user .acs-role-dot { background: #5f6368; }
            .acs-theme-gemini .acs-o-msg-assistant .acs-o-msg-role { color: #4285f4; }
            .acs-theme-gemini .acs-o-msg-assistant .acs-role-dot { background: #4285f4; }
            .acs-theme-gemini .acs-o-msg-assistant .acs-o-msg-role::after {
                content: '✦';
                font-size: 11px;
                margin-left: 2px;
                color: #4285f4;
            }
            .acs-theme-gemini .acs-o-inputbar { border-top: 1px solid rgba(0,0,0,0.07); background: #ffffff; }
            .acs-theme-gemini .acs-o-input-row { background: #f8f9fa; border: 1px solid rgba(0,0,0,0.1); border-radius: 24px; }
            .acs-theme-gemini .acs-o-input-row:focus-within { border-color: #4285f4; box-shadow: 0 0 0 2px rgba(66,133,244,0.12); }
            .acs-theme-gemini .acs-o-textarea { color: #1f1f1f; }
            .acs-theme-gemini .acs-o-textarea::placeholder { color: rgba(0,0,0,0.35); }
            .acs-theme-gemini .acs-o-sendbtn { background: #4285f4; border-radius: 50%; }
        `);
    };

    // ═══════════════════════════════════════════════════════════════
    //  SIDEBAR INJECTOR
    // ═══════════════════════════════════════════════════════════════

    const SidebarInjector = {
        observer: null,
        lastHash: '',

        init() {
            this.startObserving();
            setTimeout(() => this.tryInject(), 1500);
            setInterval(() => this.tryInject(), INJECT_INTERVAL);
        },

        startObserving() {
            this.observer = new MutationObserver(Utils.debounce(() => this.tryInject(), 600));
            this.observer.observe(document.body, { childList: true, subtree: true });
        },

        findSidebar() {
            switch (CURRENT_PLATFORM) {
                case PLATFORMS.CHATGPT: return this._findChatGPTSidebar();
                case PLATFORMS.CLAUDE: return this._findClaudeSidebar();
                case PLATFORMS.GEMINI: return this._findGeminiSidebar();
                default: return null;
            }
        },

        _findChatGPTSidebar() {
            // ChatGPT: nav contains conversation links (a[href*="/c/"])
            for (const nav of document.querySelectorAll('nav')) {
                if (nav.querySelector('a[href*="/c/"]')) return nav;
                const list = nav.querySelector('ol, ul');
                if (list && list.children.length >= 1) return nav;
            }
            return document.querySelector('nav');
        },

        _findClaudeSidebar() {
            // Claude: find container holding chat links (a[href*="/chat/"])
            const links = document.querySelectorAll('a[href*="/chat/"]');
            if (links.length > 0) {
                let el = links[0].parentElement;
                for (let i = 0; i < 6 && el; i++) {
                    const style = window.getComputedStyle(el);
                    if (style.overflowY === 'auto' || style.overflowY === 'scroll' || el.children.length > 3) {
                        return el;
                    }
                    el = el.parentElement;
                }
                return links[0].parentElement;
            }
            return document.querySelector('nav');
        },

        _findGeminiSidebar() {
            return document.querySelector('side-navigation') ||
                document.querySelector('[class*="side-nav"]') ||
                document.querySelector('[role="navigation"]') ||
                document.querySelector('nav');
        },

        tryInject() {
            const foreignChats = DataManager.getForeignChats();
            const newHash = foreignChats.map(c => c.id + c.lastUpdated).join('|');

            // Skip if nothing changed and section still exists
            if (newHash === this.lastHash && document.getElementById('acs-synced-section')) return;

            // Remove stale section
            const existing = document.getElementById('acs-synced-section');
            if (existing) existing.remove();

            if (foreignChats.length === 0) {
                this.lastHash = newHash;
                return;
            }

            const sidebar = this.findSidebar();
            if (!sidebar) return;

            this.lastHash = newHash;
            const section = this._buildSection(foreignChats);
            sidebar.appendChild(section);
        },

        _buildSection(chats) {
            const section = document.createElement('div');
            section.id = 'acs-synced-section';
            section.className = `acs-synced-section acs-host-${CURRENT_PLATFORM}`;

            // Divider
            const divider = document.createElement('div');
            divider.className = 'acs-synced-divider';
            section.appendChild(divider);

            // Label
            const label = document.createElement('div');
            label.className = 'acs-synced-label';
            label.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg><span>Synced Chats</span>`;
            section.appendChild(label);

            // Items grouped by platform
            const grouped = {};
            chats.forEach(c => {
                (grouped[c.platform] = grouped[c.platform] || []).push(c);
            });

            for (const [platform, platformChats] of Object.entries(grouped)) {
                const meta = PLATFORM_META[platform];
                platformChats.forEach(chat => {
                    const item = document.createElement('div');
                    item.className = 'acs-sidebar-item';
                    item.setAttribute('data-acs-id', chat.id);
                    item.innerHTML = `
                        <div class="acs-badge" style="background: ${meta.gradient}">
                            ${meta.icon}
                        </div>
                        <div class="acs-sidebar-item-text">
                            <div class="acs-sidebar-item-title">${Utils.escapeHtml(chat.title || 'Untitled')}</div>
                            <div class="acs-sidebar-item-meta">
                                <span>${meta.name}</span>
                                <span>·</span>
                                <span>${Utils.timeAgo(chat.lastUpdated)}</span>
                            </div>
                        </div>
                    `;
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        NativeChatRenderer.render(chat);
                    });
                    section.appendChild(item);
                });
            }

            return section;
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  NATIVE CHAT RENDERER
    // ═══════════════════════════════════════════════════════════════

    const NativeChatRenderer = {
        activeChat: null,
        overlayEl: null,

        render(chat) {
            this.close();
            this.activeChat = chat;

            const meta = PLATFORM_META[chat.platform];
            const hostMeta = PLATFORM_META[CURRENT_PLATFORM];

            const overlay = document.createElement('div');
            overlay.id = 'acs-chat-overlay';
            overlay.className = `acs-overlay acs-theme-${CURRENT_PLATFORM}`;

            // Position to the right of the sidebar
            const sidebarWidth = this._getSidebarWidth();
            overlay.style.left = sidebarWidth + 'px';

            overlay.innerHTML = `
                <div class="acs-o-header">
                    <button class="acs-o-back" title="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                    </button>
                    <div class="acs-o-info">
                        <div class="acs-o-title">${Utils.escapeHtml(chat.title || 'Untitled Chat')}</div>
                        <div class="acs-o-source">
                            <span class="acs-o-source-badge" style="background: ${meta.gradient}">${meta.icon}&nbsp;${meta.name}</span>
                            <span>${chat.messages.length} messages · ${Utils.timeAgo(chat.lastUpdated)}</span>
                        </div>
                    </div>
                </div>
                <div class="acs-o-messages">
                    <div class="acs-o-messages-inner">
                        ${chat.messages.map(m => this._renderMsg(m, chat.platform)).join('')}
                    </div>
                </div>
                <div class="acs-o-inputbar">
                    <div class="acs-o-input-wrap">
                        <div class="acs-o-input-row">
                            <textarea class="acs-o-textarea" rows="1" placeholder="Continue this conversation on ${hostMeta.name}…"></textarea>
                            <button class="acs-o-sendbtn" disabled style="background: ${hostMeta.gradient}" title="Send with context">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                            </button>
                        </div>
                        <div class="acs-o-hint">Context from this conversation will be included · you'll review before sending</div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            this.overlayEl = overlay;

            // Animate in
            requestAnimationFrame(() => {
                requestAnimationFrame(() => overlay.classList.add('acs-visible'));
            });

            // Scroll to bottom
            const msgs = overlay.querySelector('.acs-o-messages');
            msgs.scrollTop = msgs.scrollHeight;

            // Wire events
            this._wireEvents(overlay, chat);
        },

        _wireEvents(overlay, chat) {
            // Close button
            overlay.querySelector('.acs-o-back').addEventListener('click', () => this.close());

            const textarea = overlay.querySelector('.acs-o-textarea');
            const sendBtn = overlay.querySelector('.acs-o-sendbtn');

            // Auto-resize
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
                sendBtn.disabled = !textarea.value.trim();
            });

            // Send on click
            sendBtn.addEventListener('click', () => {
                const msg = textarea.value.trim();
                if (msg) ContextManager.sendWithContext(chat, msg);
            });

            // Send on Enter (Shift+Enter for newline)
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const msg = textarea.value.trim();
                    if (msg) ContextManager.sendWithContext(chat, msg);
                }
            });

            // Escape to close
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.close();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        },

        _renderMsg(msg, sourcePlatform) {
            const isUser = msg.role === 'user';
            const roleClass = isUser ? 'acs-o-msg-user' : 'acs-o-msg-assistant';
            const roleName = isUser ? 'You' : PLATFORM_META[sourcePlatform].name;
            const dotColor = isUser ? '' : PLATFORM_META[sourcePlatform].color;

            return `
                <div class="acs-o-msg ${roleClass}">
                    <div class="acs-o-msg-role">
                        <span class="acs-role-dot" ${!isUser ? `style="background:${dotColor}"` : ''}></span>
                        ${Utils.escapeHtml(roleName)}
                    </div>
                    <div class="acs-o-msg-content">${Utils.escapeHtml(msg.content)}</div>
                </div>
            `;
        },

        _getSidebarWidth() {
            const selectors = {
                chatgpt: 'nav',
                claude: 'nav, [class*="sidebar"]',
                gemini: 'side-navigation, [class*="side-nav"], nav'
            };
            const el = document.querySelector(selectors[CURRENT_PLATFORM]);
            return el ? el.getBoundingClientRect().width : 0;
        },

        close() {
            this.activeChat = null;
            if (this.overlayEl) {
                this.overlayEl.classList.remove('acs-visible');
                const el = this.overlayEl;
                setTimeout(() => el.remove(), 280);
                this.overlayEl = null;
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  CONTEXT MANAGER
    // ═══════════════════════════════════════════════════════════════

    const ContextManager = {
        formatContext(chat, userMessage) {
            const meta = PLATFORM_META[chat.platform];
            let ctx = `[CONTEXT: Continuing a conversation from ${meta.name} — "${chat.title}"]\n\n`;

            chat.messages.forEach(m => {
                ctx += `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}\n\n`;
            });

            ctx += `[END OF CONTEXT]\n\nPlease continue this conversation naturally. Here is my new message:\n\n${userMessage}`;
            return ctx;
        },

        sendWithContext(chat, userMessage) {
            const contextText = this.formatContext(chat, userMessage);

            // Close overlay
            NativeChatRenderer.close();
            Utils.showToast(`Preparing context from "${chat.title}"…`, 2500);

            // Navigate to new chat
            this._navigateNewChat();

            // Poll for input, then paste
            let attempts = 0;
            const poll = setInterval(() => {
                attempts++;
                const input = this._getInputField();

                if (input) {
                    clearInterval(poll);
                    setTimeout(() => {
                        this._pasteInto(input, contextText);
                        Utils.showToast('Context pasted — review and hit send when ready!', 5000);
                    }, 600);
                }

                if (attempts >= 30) {
                    clearInterval(poll);
                    // Fallback: copy to clipboard
                    navigator.clipboard.writeText(contextText).then(() => {
                        Utils.showToast('Copied context to clipboard — paste it manually (Ctrl+V)', 6000);
                    }).catch(() => {
                        Utils.showToast('Could not auto-paste. Please try again.', 5000);
                    });
                }
            }, 500);
        },

        _navigateNewChat() {
            // Try SPA-friendly navigation first (clicking native new-chat button)
            const btn = this._findNewChatButton();
            if (btn) {
                btn.click();
                return;
            }
            // Fallback: URL navigation
            const url = PLATFORM_META[CURRENT_PLATFORM].newChatUrl;
            window.location.href = url;
        },

        _findNewChatButton() {
            switch (CURRENT_PLATFORM) {
                case PLATFORMS.CHATGPT:
                    return document.querySelector('[data-testid="create-new-chat-button"]') ||
                        document.querySelector('a[href="/"]') ||
                        document.querySelector('nav a:first-of-type');
                case PLATFORMS.CLAUDE:
                    return document.querySelector('a[href="/new"]') ||
                        document.querySelector('[data-testid="new-chat-button"]') ||
                        document.querySelector('button[aria-label*="New"]');
                case PLATFORMS.GEMINI:
                    return document.querySelector('a[href="/app"]') ||
                        document.querySelector('button[aria-label*="New chat"]') ||
                        document.querySelector('[data-testid="new-chat-button"]');
                default:
                    return null;
            }
        },

        _getInputField() {
            switch (CURRENT_PLATFORM) {
                case PLATFORMS.CHATGPT:
                    return document.querySelector('#prompt-textarea') ||
                        document.querySelector('div[contenteditable="true"]');
                case PLATFORMS.CLAUDE:
                    return document.querySelector('div[contenteditable="true"].ProseMirror') ||
                        document.querySelector('div[contenteditable="true"]');
                case PLATFORMS.GEMINI:
                    return document.querySelector('.ql-editor') ||
                        document.querySelector('div[contenteditable="true"]');
                default:
                    return null;
            }
        },

        _pasteInto(input, text) {
            input.focus();

            if (input.tagName === 'TEXTAREA') {
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, 'value'
                )?.set;
                if (setter) setter.call(input, text);
                else input.value = text;

                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (input.contentEditable === 'true') {
                // Clear first
                input.innerHTML = '';
                input.focus();

                // execCommand is most compatible with React/framework state
                const ok = document.execCommand('insertText', false, text);

                if (!ok) {
                    // Fallback: set textContent directly
                    input.textContent = text;
                }

                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            }

            // Move cursor to end
            try {
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(input);
                range.collapse(false);
                sel?.removeAllRanges();
                sel?.addRange(range);
            } catch (_) { /* ignore if selection fails */ }
        },

        // Handle pending context from full-page navigations
        checkPending() {
            const pending = GM_getValue('acs_pending_ctx', null);
            if (!pending) return;
            GM_setValue('acs_pending_ctx', null);

            let attempts = 0;
            const poll = setInterval(() => {
                attempts++;
                const input = this._getInputField();
                if (input) {
                    clearInterval(poll);
                    setTimeout(() => {
                        this._pasteInto(input, pending);
                        Utils.showToast('Context pasted — review and send when ready!', 5000);
                    }, 800);
                }
                if (attempts >= 20) clearInterval(poll);
            }, 500);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  URL CHANGE DETECTION (SPA navigation)
    // ═══════════════════════════════════════════════════════════════

    const URLWatcher = {
        lastUrl: window.location.href,

        init() {
            // Detect client-side navigations
            setInterval(() => {
                const current = window.location.href;
                if (current !== this.lastUrl) {
                    this.lastUrl = current;
                    this._onUrlChange();
                }
            }, 800);

            // Also catch popstate
            window.addEventListener('popstate', () => {
                setTimeout(() => this._onUrlChange(), 100);
            });
        },

        _onUrlChange() {
            // Close any open overlay
            NativeChatRenderer.close();
            // Re-inject sidebar items (sidebar may have re-rendered)
            SidebarInjector.lastHash = '';
            setTimeout(() => SidebarInjector.tryInject(), 500);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    //  INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    const init = () => {
        console.log(`[AI Chat Sync] v2.0 loaded on ${PLATFORM_META[CURRENT_PLATFORM].name}`);

        injectStyles();
        SidebarInjector.init();
        URLWatcher.init();
        ContextManager.checkPending();

        // Menu command
        GM_registerMenuCommand('AI Chat Sync — Status', () => {
            const foreign = DataManager.getForeignChats();
            const all = DataManager.getAllChats();
            Utils.showToast(
                foreign.length > 0
                    ? `${foreign.length} synced chat(s) from other platforms · ${all.length} total`
                    : 'No synced chats yet — visit other AI platforms first!',
                4000
            );
        });

        // Extract current conversation periodically
        const extract = () => {
            try {
                const data = Extractors[CURRENT_PLATFORM]();
                if (data && data.messages.length > 0) {
                    DataManager.saveChat(data);
                }
            } catch (e) {
                console.warn('[AI Chat Sync] Extraction error:', e);
            }
        };

        setTimeout(extract, 2500);
        setInterval(extract, SYNC_INTERVAL);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
