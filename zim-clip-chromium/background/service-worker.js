importScripts('../thirdparty/date.format.js', '../common/Logger.js');

const APP_NAME = 'zimclip';
const OPTION_LINK_PATTERN_DEFAULT = '[[${page.url}|${page.title}]]';
const OPTION_CLIP_PATTERN_DEFAULT = '${page.selection}\n\n[[${page.url}|${page.title}]]';
const OPTION_FORMAT_DEFAULT = 'zim';
const OPTION_MARK_NOTEBOOK_DEFAULT = '__default__';
const KEYS_FORMAT = {date: ['date', 'modified', 'updated']};
const RE_PLACEHOLDER = /\$\{\s*([^}]+)\s*\}/g;
const logger = new Logger(APP_NAME);

function isMarkable(url) {
    return typeof url === 'string' && !url.startsWith('about') &&
        !url.startsWith('browser') && !url.startsWith('chrome') &&
        !url.startsWith('edge');
}

function formatDate(str, fmt) {
    const dt = Date.parse(str);
    if (Number.isNaN(dt)) return str;
    return new Date(dt).format(fmt);
}

function format(pattern, data) {
    return pattern.replace(RE_PLACEHOLDER, (matches, p1) => {
        let key = p1.substr(5);
        let fmt = null;

        if (key.includes('|')) {
            [key, fmt] = key.split('|').map(v => v.trim());
        }

        let value = data[key] || '';

        if (fmt && KEYS_FORMAT.date.includes(key)) {
            value = formatDate(value, fmt);
        }

        return value;
    });
}

async function getActiveTab() {
    const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    return tabs[0] || null;
}

function sendToZim(args) {
    return new Promise((resolve, reject) => {
        let connection;

        try {
            connection = chrome.runtime.connectNative(APP_NAME);
        } catch (err) {
            reject(err);
            return;
        }

        let settled = false;

        connection.onMessage.addListener(message => {
            logger.info(JSON.stringify(message));

            if (message && message.ok && !settled) {
                settled = true;
                resolve();
            }
        });

        connection.onDisconnect.addListener(() => {
            const error = chrome.runtime.lastError;

            if (settled) {
                return;
            }

            if (error) {
                logger.error(error.message);
                settled = true;
                reject(new Error(error.message));
            } else {
                settled = true;
                resolve();
            }
        });

        try {
            connection.postMessage(args);
        } catch (err) {
            if (!settled) {
                settled = true;
                reject(err);
            }
        }
    });
}

async function mark() {
    const tab = await getActiveTab();
    if (!tab || !isMarkable(tab.url)) return;

    const pref = await chrome.storage.local.get({
        markNotebook: OPTION_MARK_NOTEBOOK_DEFAULT,
        linkPattern: OPTION_LINK_PATTERN_DEFAULT
    });

    const data = await chrome.tabs.sendMessage(
        tab.id,
        {action: 'metas'}
    );

    const text = format(pref.linkPattern, data);

    const basename = (data.title || 'clip')
        .replace(/[:./]/g, '')
        .trim()
        .slice(0, 120)
        .trim();

    await sendToZim([
        `notebook=${pref.markNotebook || OPTION_MARK_NOTEBOOK_DEFAULT}`,
        `basename=${basename}`,
        `text=${encodeURIComponent(text)}`,
        'marks'
    ]);
}

async function clip() {
    const tab = await getActiveTab();
    if (!tab || !isMarkable(tab.url)) return;

    const pref = await chrome.storage.local.get({
        clipNotebook: OPTION_MARK_NOTEBOOK_DEFAULT,
        clipDestination: 'zim',
        format: OPTION_FORMAT_DEFAULT,
        clipPattern: OPTION_CLIP_PATTERN_DEFAULT
    });

    const data = await chrome.tabs.sendMessage(
        tab.id,
        {action: 'html2wiki', name: pref.format}
    );

    data.selection = format(pref.clipPattern, data);

    // --- Clip: Clipboard ---
    if (pref.clipDestination === 'clipboard') {
        await sendToZim([
            `text=${encodeURIComponent(data.selection)}`,
            'clipboard'
        ]);

        return;
    }

    // --- Clip: Zim default location ---
    const args = [
        `notebook=${pref.clipNotebook || OPTION_MARK_NOTEBOOK_DEFAULT}`,
        `option:url=${tab.url}`,
        `basename=${(data.title || 'clip').replace(/[:./]/g, '').trim()}`,
        `text=${encodeURIComponent(data.selection)}`,
        'clips'
    ];

    await sendToZim(args);
}

async function initPrefs() {
    await chrome.storage.local.set(await chrome.storage.local.get({
        markNotebook: OPTION_MARK_NOTEBOOK_DEFAULT,
        linkPattern: OPTION_LINK_PATTERN_DEFAULT,
        clipPattern: OPTION_CLIP_PATTERN_DEFAULT,
        format: OPTION_FORMAT_DEFAULT
    }));
}

async function initContextMenus() {
    await chrome.contextMenus.removeAll();

    chrome.contextMenus.create({
        id: 'markToZim',
        title: 'Mark current page in Zim',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'clipToZim',
        title: 'Copy selected content to Zim',
        contexts: ['selection']
    });
}

chrome.runtime.onInstalled.addListener(() => {
    initPrefs().catch(err => logger.error(err));
    initContextMenus().catch(err => logger.error(err));
});

chrome.runtime.onStartup.addListener(() => {
    initPrefs().catch(err => logger.error(err));
    initContextMenus().catch(err => logger.error(err));
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'markToZim') {
        mark().catch(err => logger.error(err));
    } else if (info.menuItemId === 'clipToZim') {
        clip().catch(err => logger.error(err));
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message.action === 'state') {
            const tab = await getActiveTab();
            let hasSelection = false;

            if (tab && isMarkable(tab.url)) {
                try {
                    const result = await chrome.tabs.sendMessage(
                        tab.id,
                        {action: 'hasSelection'}
                    );

                    hasSelection = !!result.hasSelection;
                } catch (e) {}
            }

            sendResponse({
                markable: !!tab && isMarkable(tab.url),
                hasSelection
            });

            return;
        }

        if (message.action === 'markToZim') {
            await mark();
            sendResponse({ok: true});
            return;
        }

        if (message.action === 'clipToZim') {
            await clip();
            sendResponse({ok: true});
            return;
        }

        sendResponse({
            ok: false,
            error: 'Unknown action'
        });
    })().catch(err => {
        logger.error(err && err.stack ? err.stack : String(err));

        sendResponse({
            ok: false,
            error: String(err)
        });
    });

    return true;
});
