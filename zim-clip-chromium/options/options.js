/*global browser, Logger */
// import { Logger } from '../common/Logger.js';

let defaults = {};

const logger = new Logger('zim-clip', document.getElementById('logger'));

let loggerFadeId = null;

/**
 * List of HTMLInputElements binded to options.
 * @type {NodeListOf<HTMLInputElement>}
 */
const optionsList = document.querySelectorAll('input, select, textarea');


const getNotebooks = function () {
    return new Promise(function (resolve) {
        let connection;

        try {
            connection = browser.runtime.connectNative('zimclip');
        } catch (err) {
            resolve([]);
            return;
        }

        let settled = false;

        connection.onMessage.addListener(function (message) {
            if (settled) {
                return;
            }

            if (message && message.type === 'notebooks') {
                settled = true;
                resolve(message.notebooks || []);
                connection.disconnect();
            }
        });

        connection.onDisconnect.addListener(function () {
            if (!settled) {
                settled = true;
                resolve([]);
            }
        });

        try {
            connection.postMessage(['list_notebooks']);
        } catch (err) {
            if (!settled) {
                settled = true;
                resolve([]);
            }
        }
    });
};


const loadNotebooks = function () {
    const selects = [
        document.getElementById('markNotebook'),
        document.getElementById('clipNotebook')
    ];

    return getNotebooks().then(function (notebooks) {
        selects.forEach(function (select) {
            notebooks.forEach(function (notebook) {
                const option = document.createElement('option');

                option.value = notebook.uri;
                option.textContent = notebook.name || notebook.uri;
                option.title = notebook.uri;

                select.appendChild(option);
            });
        });
    });
};


/**
 * Load options with default values.
 *
 * @return {Promise} Options have been loaded.
 */
const load = function () {
    defaults = {};

    optionsList.forEach(function (input) {
        defaults[input.id] = input.dataset.def;
    });

    return browser.storage.local.get(defaults)
        .then(function (items) {
            return loadNotebooks().then(function () {
                optionsList.forEach(function (input) {
                    let value = items[input.id];

                    if (
                        input.id === 'markNotebook' &&
                        value !== '__default__' &&
                        !Array.from(input.options).some(
                            option => option.value === value
                        )
                    ) {
                        value = '__default__';
                    }

                    input.value = value;
                });
            });
        });
};


/**
 * Save options to local storage.
 *
 * @return {Promise} When options have been saved.
 */
const save = function () {
    let data = {};

    optionsList.forEach(function (input) {
        data[input.id] = input.dataset.def;

        let value = input.value;

        if (value) {
            data[input.id] = value;
        }
    });

    return browser.storage.local.set(data);
};


const log = function (type, message) {
    if (loggerFadeId !== null) {
        window.clearTimeout(loggerFadeId);
        loggerFadeId = null;
    }

    logger[type](message);
    logger.element.style.opacity = '1';

    loggerFadeId = window.setTimeout(() => {
        logger.element.style.opacity = '0';
    }, 3000);
};


const localize = function () {
    // TODO
};


// run
document.addEventListener('DOMContentLoaded', () => {
    load().then(localize).catch(() => {
        // TODO
    });
});

document.getElementById('save').addEventListener('click', () => {
    save().then(() => {
        log('info', browser.i18n.getMessage('optionsSaved'));
    }).catch((err) => {
        log('warn', browser.i18n.getMessage('optionsSavedError', err));
    });
});
