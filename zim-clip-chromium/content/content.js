/*global browser, Html2Wiki */

var zimclip = {
    RE_CHARS: /[:./]/g,

    META_KEYS: [
        'title',
        'type',
        'image',
        'url',
        'author',
        'date',
        'modified',
        'publisher',
        'description',
        'keywords'
    ],

    META_KEYS_MAP: {
        'creator': 'author',
        'created': 'date',
        'published_time': 'date',
        'modified_time': 'modified',
        'publisher': 'site_name'
    },

    META_DATE: [
        'date',
        'modified'
    ],

    metas: {},
    currentMeta: null,

    siteProfile: null,
    siteProfilePromise: null,

    getTitle: function (title) {
        if (!title) title = document.title;

        return title
            .replace(zimclip.RE_CHARS, '-')
            .replace(/["«»„“”]/g, '')
            .trim();
    },

    /*
     * =========================================================
     * Profile loading
     * =========================================================
     */

    getProfileHostname: function () {
        var hostname = window.location.hostname.toLowerCase();

        if (hostname.indexOf('www.') === 0) {
            hostname = hostname.substring(4);
        }

        return hostname;
    },

    loadSiteProfile: function () {
        if (zimclip.siteProfilePromise) {
            return zimclip.siteProfilePromise;
        }

        var hostname = zimclip.getProfileHostname();
        var url = browser.runtime.getURL(
            'settings/' + hostname.replace(/\./g, '_') + '.json'
        );

        zimclip.siteProfilePromise = fetch(url)
            .then(function (response) {
                if (!response.ok) {
                    return null;
                }

                return response.json();
            })
            .then(function (profile) {
                zimclip.siteProfile = profile;
                return profile;
            })
            .catch(function () {
                zimclip.siteProfile = null;
                return null;
            });

        return zimclip.siteProfilePromise;
    },

    getYouTubeTranscript: function () {
        let segments = [
            ...document.querySelectorAll(
                'ytd-transcript-segment-renderer'
            )
        ];

        if (!segments.length) {
            segments = [
                ...document.querySelectorAll(
                    'transcript-segment-view-model'
                )
            ];

            return segments
                .map(segment => {
                    const timestamp =
                        segment.querySelector(
                            '.ytwTranscriptSegmentViewModelTimestamp'
                        )?.textContent.trim();

                    const text =
                        segment.querySelector(
                            '.ytAttributedStringHost'
                        )?.textContent.trim();

                    if (!timestamp || !text) {
                        return '';
                    }

                    return `${timestamp} ${text}`;
                })
                .filter(Boolean)
                .join('\n');
        }

        return segments
            .map(segment =>
                segment.innerText
                    .split('\n')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .join(' ')
            )
            .filter(Boolean)
            .join('\n');
    },

    /*
     * =========================================================
     * HTML → Wiki
     * =========================================================
     */

    html2Wiki: async function (name) {
        var h2w = new Html2Wiki(name),
            selection = window.getSelection(),
            data = await zimclip.getMetas(),
            i = 0;

        data.selection = '';
        data.pics = null;

        if (
            window.location.hostname.includes('youtube.com')
        ) {
            const transcript =
                zimclip.getYouTubeTranscript();

            if (transcript) {
                data.selection = transcript;
                return data;
            }
        }

        for (i = 0; i < selection.rangeCount; i += 1) {
            data.selection += h2w.read(
                selection.getRangeAt(i).cloneContents()
            );
        }

        data.selection = data.selection.trim();
        data.pics = h2w.getRule('img').getPics();

        return data;
    },

    /*
     * =========================================================
     * Metadata entry point
     * =========================================================
     */

    getMetas: async function () {
        var profile = await zimclip.loadSiteProfile();

        /*
         * A site with a profile is handled ONLY by that profile.
         * The old universal matching mechanism is not used.
         */
        if (profile) {
            zimclip.metas = {};

            zimclip.metas.url = window.location.href;

            return zimclip.readProfile(profile);
        }

        /*
         * No profile:
         * keep the old mechanism as fallback.
         */
        return zimclip.getMetasFallback();
    },

    /*
     * =========================================================
     * Profile-based metadata
     * =========================================================
     */

    readProfile: function (profile) {
        var jsonLd = zimclip.getJsonLdObjects();

        zimclip.META_KEYS.forEach(function (key) {
            if (!profile[key]) {
                return;
            }

            var value = zimclip.readProfileField(
                profile[key],
                jsonLd
            );

            if (value) {
                if (key === 'title') {
                    value = zimclip.getTitle(value);
                }

                zimclip.metas[key] = value;
            }
        });

        /*
         * Keep URL available even when it is not explicitly
         * specified in the profile.
         */
        if (!zimclip.metas.url) {
            zimclip.metas.url = window.location.href;
        }

        return zimclip.metas;
    },

    /*
     * One field may contain several sources.
     *
     * Example:
     *
     * "title": [
     *     "jsonld.headline",
     *     "meta[property=\"og:title\"]"
     * ]
     *
     * Sources are tried from left to right.
     */
    readProfileField: function (sources, jsonLd) {
        if (!Array.isArray(sources)) {
            sources = [sources];
        }

        for (var i = 0; i < sources.length; i += 1) {
            var values = zimclip.readProfileSource(
                sources[i],
                jsonLd
            );

            if (!values || !values.length) {
                continue;
            }

            for (var j = 0; j < values.length; j += 1) {
                var value = zimclip.normalizeProfileValue(
                    values[j]
                );

                if (value) {
                    return value;
                }
            }
        }

        return '';
    },

    /*
     * =========================================================
     * YouTube
     * =========================================================
     *
     * Read the channel name from YouTube's ytInitialData.
     * Based on the approach used by Zotero's YouTube translator.
     */

    getYouTubeAuthor: function () {
        var author = '';

        document.querySelectorAll(
            'script:not([src])'
        ).forEach(function (script) {
            if (author) {
                return;
            }

            var raw = script.textContent;
            var marker = 'var ytInitialData = {';

            var markerPos = raw.indexOf(marker);

            if (markerPos === -1) {
                return;
            }

            var start = raw.indexOf(
                '{',
                markerPos
            );

            if (start === -1) {
                return;
            }

            var depth = 0;
            var end = start;
            var inString = false;

            while (end < raw.length) {
                var ch = raw[end];

                if (inString) {
                    if (ch === '\\') {
                        end += 1;
                    } else if (ch === '"') {
                        inString = false;
                    }
                } else if (ch === '"') {
                    inString = true;
                } else if (ch === '{') {
                    depth += 1;
                } else if (ch === '}') {
                    depth -= 1;

                    if (depth === 0) {
                        break;
                    }
                }

                end += 1;
            }

            if (depth !== 0) {
                return;
            }

            var data;

            try {
                data = JSON.parse(
                    raw.substring(start, end + 1)
                );
            } catch (e) {
                return;
            }

            zimclip.walkYouTubeData(
                data,
                function (node) {
                    var owner =
                        node.videoSecondaryInfoRenderer &&
                        node.videoSecondaryInfoRenderer.owner &&
                        node.videoSecondaryInfoRenderer.owner
                            .videoOwnerRenderer;

                    if (!owner) {
                        return false;
                    }

                    var name =
                        owner.title &&
                        owner.title.runs &&
                        owner.title.runs[0] &&
                        owner.title.runs[0].text;

                    if (name) {
                        author = name;
                        return true;
                    }

                    return false;
                }
            );
        });

        return author;
    },

    walkYouTubeData: function (node, visit) {
        if (
            !node ||
            typeof node !== 'object'
        ) {
            return false;
        }

        if (visit(node)) {
            return true;
        }

        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i += 1) {
                if (
                    zimclip.walkYouTubeData(
                        node[i],
                        visit
                    )
                ) {
                    return true;
                }
            }

            return false;
        }

        var keys = Object.keys(node);

        for (var j = 0; j < keys.length; j += 1) {
            if (
                zimclip.walkYouTubeData(
                    node[keys[j]],
                    visit
                )
            ) {
                return true;
            }
        }

        return false;
    },

    /*
     * =========================================================
     * Read one profile source
     * =========================================================
     *
     * Supported:
     *
     *   jsonld.headline
     *   jsonld.author.name
     *
     *   meta[property="og:title"]
     *   meta[name="author"]
     *   meta[itemprop="datePublished"]
     */

    readProfileSource: function (source, jsonLd) {
        if (!source || typeof source !== 'string') {
            return [];
        }

        if (source === 'youtube.author') {
            var author = zimclip.getYouTubeAuthor();

            return author ? [author] : [];
        }

        if (source.indexOf('jsonld.') === 0) {
            var path = source
                .substring('jsonld.'.length)
                .split('.')
                .filter(function (part) {
                    return part !== '';
                });

            var result = [];

            jsonLd.forEach(function (object) {
                result = result.concat(
                    zimclip.findJsonLdValues(
                        object,
                        path
                    )
                );
            });

            return result;
        }

        if (source.indexOf('value:') === 0) {
            return [source.substring('value:'.length)];
        }

        /*
         * Everything else is treated as a normal CSS selector.
         *
         * This makes meta selectors very simple:
         *
         *   meta[property="og:title"]
         *   meta[name="author"]
         *   meta[itemprop="datePublished"]
         */

        try {
            var textMode = false;

            if (source.indexOf('text:') === 0) {
                textMode = true;
                source = source.substring('text:'.length);
            }

            var elements = document.querySelectorAll(source);
            var values = [];

            elements.forEach(function (element) {
                var value;

                if (textMode) {
                    value = element.textContent;
                } else {
                    value = element.getAttribute('content');
                }

                if (value) {
                    values.push(value);
                }
            });

            return values;
        } catch (e) {
            return [];
        }
    },

    normalizeProfileValue: function (value) {
        if (value === null || value === undefined) {
            return '';
        }

        if (
            typeof value === 'string' ||
            typeof value === 'number'
        ) {
            return String(value).trim();
        }

        /*
         * JSON-LD may return an object.
         *
         * We only handle the common value forms here.
         * No schema.org interpretation is attempted.
         */
        if (typeof value === 'object') {
            if (value.name) {
                return String(value.name).trim();
            }

            if (value.url) {
                return String(value.url).trim();
            }

            if (value.contentUrl) {
                return String(value.contentUrl).trim();
            }
        }

        return '';
    },

    /*
     * =========================================================
     * JSON-LD
     * =========================================================
     */

    getJsonLdObjects: function () {
        var result = [];

        document.querySelectorAll(
            'script[type="application/ld+json"]'
        ).forEach(function (script) {
            var text = script.textContent.trim();

            if (!text) {
                return;
            }

            try {
                result.push(JSON.parse(text));
            } catch (e) {
                /*
                 * Ignore invalid JSON-LD.
                 */
            }
        });

        return result;
    },

    /*
     * Find a JSON value using an explicit path.
     *
     * Example:
     *
     *   ["author", "name"]
     *
     * Also works when an intermediate value is an array.
     */
    readJsonPath: function (value, path) {
        if (!path.length) {
            return [value];
        }

        if (Array.isArray(value)) {
            var arrayResult = [];

            value.forEach(function (item) {
                arrayResult = arrayResult.concat(
                    zimclip.readJsonPath(
                        item,
                        path
                    )
                );
            });

            return arrayResult;
        }

        if (
            !value ||
            typeof value !== 'object'
        ) {
            return [];
        }

        var key = path[0];

        if (!Object.prototype.hasOwnProperty.call(
            value,
            key
        )) {
            return [];
        }

        return zimclip.readJsonPath(
            value[key],
            path.slice(1)
        );
    },

    /*
     * Search the JSON-LD tree recursively.
     *
     * This is deliberately generic.
     * We do not assign any meaning to:
     *
     *   author
     *   publisher
     *   headline
     *
     * The profile specifies the path.
     */
    findJsonLdValues: function (root, path) {
        var direct = zimclip.readJsonPath(
            root,
            path
        );

        if (direct.length) {
            return direct;
        }

        var result = [];

        if (Array.isArray(root)) {
            root.forEach(function (item) {
                result = result.concat(
                    zimclip.findJsonLdValues(
                        item,
                        path
                    )
                );
            });

            return result;
        }

        if (
            !root ||
            typeof root !== 'object'
        ) {
            return result;
        }

        Object.keys(root).forEach(function (key) {
            var value = root[key];

            if (
                value &&
                typeof value === 'object'
            ) {
                result = result.concat(
                    zimclip.findJsonLdValues(
                        value,
                        path
                    )
                );
            }
        });

        return result;
    },

    /*
     * =========================================================
     * Old metadata mechanism — FALLBACK ONLY
     * =========================================================
     */

    getMetasFallback: function () {
        zimclip.metas = {};

        zimclip.metas.url = window.location.href;

        document.head
            .querySelectorAll('meta')
            .forEach(zimclip.readMeta);

        zimclip.readFallbacks();

        return zimclip.metas;
    },

    matchMeta: function (key) {
        var property = zimclip.currentMeta
                .getAttribute('property'),
            name = zimclip.currentMeta
                .getAttribute('name'),
            itemprop = zimclip.currentMeta
                .getAttribute('itemprop');

        return (
            (property &&
                property.toLowerCase().endsWith(key)) ||

            (name &&
                name.toLowerCase().endsWith(key)) ||

            (itemprop &&
                itemprop.toLowerCase() === key)
        );
    },

    readMeta: function (meta) {
        zimclip.currentMeta = meta;

        var name = zimclip.META_KEYS.find(
            zimclip.matchMeta
        );

        if (!name) {
            name = Object.keys(
                zimclip.META_KEYS_MAP
            ).find(zimclip.matchMeta);

            if (name) {
                name = zimclip.META_KEYS_MAP[name];
            }
        }

        if (
            name &&
            !zimclip.metas[name]
        ) {
            var value = meta.getAttribute(
                'content'
            );

            if (value) {
                if (name === 'title') {
                    value = zimclip.getTitle(
                        value
                    );
                }

                zimclip.metas[name] = value;
            }
        }

        zimclip.readArticleMeta(meta);
    },

    readArticleMeta: function (meta) {
        var property = meta.getAttribute(
            'property'
        );

        if (!property) {
            return;
        }

        property = property.toLowerCase();

        var value = meta.getAttribute(
            'content'
        );

        if (!value) {
            return;
        }

        if (
            property === 'article:published_time' &&
            !zimclip.metas.date
        ) {
            zimclip.metas.date = value;
        }

        if (
            property === 'article:modified_time' &&
            !zimclip.metas.modified
        ) {
            zimclip.metas.modified = value;
        }

        if (
            property === 'article:author' &&
            !zimclip.metas.author
        ) {
            zimclip.metas.author = value;
        }

        if (
            property === 'article:section' &&
            !zimclip.metas.section
        ) {
            zimclip.metas.section = value;
        }

        if (property === 'article:tag') {
            if (!zimclip.metas.keywords) {
                zimclip.metas.keywords = [];
            }

            if (
                !zimclip.metas.keywords.includes(
                    value
                )
            ) {
                zimclip.metas.keywords.push(
                    value
                );
            }
        }
    },

    readFallbacks: function () {
        if (!zimclip.metas.title) {
            zimclip.metas.title =
                zimclip.getTitle();
        }

        if (!zimclip.metas.publisher) {
            var meta = document.querySelector(
                'meta[name="application-name"]'
            );

            if (meta) {
                var value = meta.getAttribute(
                    'content'
                );

                if (value) {
                    zimclip.metas.publisher =
                        value;
                }
            }
        }

        if (!zimclip.metas.publisher) {
            zimclip.metas.publisher =
                window.location.hostname;
        }

        zimclip.readJsonLdFallback();
    },

    /*
     * Old JSON-LD parser is retained only for
     * unprofiled sites.
     */
    readJsonLdFallback: function () {
        zimclip.getJsonLdObjects().forEach(
            zimclip.readJsonLdObject
        );
    },

    readJsonLd: function () {
        zimclip.readJsonLdFallback();
    },

    readJsonLdObject: function (data) {
        if (Array.isArray(data)) {
            data.forEach(
                zimclip.readJsonLdObject
            );

            return;
        }

        if (
            !data ||
            typeof data !== 'object'
        ) {
            return;
        }

        if (Array.isArray(data['@graph'])) {
            data['@graph'].forEach(
                zimclip.readJsonLdObject
            );
        }

        zimclip.setJsonLdValue(
            'title',
            data.headline || data.name
        );

        zimclip.setJsonLdValue(
            'description',
            data.description
        );

        zimclip.setJsonLdValue(
            'date',
            data.datePublished
        );

        zimclip.setJsonLdValue(
            'modified',
            data.dateModified
        );

        zimclip.setJsonLdValue(
            'url',
            data.url
        );

        zimclip.setJsonLdValue(
            'image',
            data.image
        );

        if (data.author) {
            zimclip.setJsonLdPerson(
                'author',
                data.author
            );
        }

        if (data.publisher) {
            zimclip.setJsonLdPerson(
                'publisher',
                data.publisher
            );
        }

        if (data.keywords) {
            zimclip.setJsonLdKeywords(
                data.keywords
            );
        }

        if (data['@type']) {
            zimclip.setJsonLdValue(
                'type',
                data['@type']
            );
        }
    },

    setJsonLdValue: function (key, value) {
        if (
            zimclip.metas[key] ||
            !value
        ) {
            return;
        }

        if (
            typeof value === 'object' &&
            !Array.isArray(value)
        ) {
            if (value.url) {
                value = value.url;
            } else {
                return;
            }
        }

        zimclip.metas[key] = value;
    },

    setJsonLdPerson: function (key, value) {
        if (
            zimclip.metas[key] ||
            !value
        ) {
            return;
        }

        if (Array.isArray(value)) {
            value = value[0];
        }

        if (typeof value === 'object') {
            value =
                value.name ||
                value.url;
        }

        if (value) {
            zimclip.metas[key] = value;
        }
    },

    setJsonLdKeywords: function (value) {
        if (!value) {
            return;
        }

        if (typeof value === 'string') {
            if (!zimclip.metas.keywords) {
                zimclip.metas.keywords = value;
            }

            return;
        }

        if (Array.isArray(value)) {
            if (!zimclip.metas.keywords) {
                zimclip.metas.keywords =
                    value.join(', ');
            }
        }
    }
};

function hasYouTubeTranscript() {
    return window.location.hostname.includes('youtube.com') &&
        [...document.querySelectorAll('button')].some(
            button =>
                button.getAttribute('aria-label') ===
                'Показать текст видео'
        );
}

let lastTranscriptState = hasYouTubeTranscript();

const transcriptObserver =
    new MutationObserver(() => {
        const current = hasYouTubeTranscript();

        if (current === lastTranscriptState) {
            return;
        }

        lastTranscriptState = current;

        browser.runtime.sendMessage({
            action: 'transcriptState',
            hasTranscript: current
        }).catch(() => {});
    });

transcriptObserver.observe(
    document.documentElement,
    {
        childList: true,
        subtree: true
    }
);

window.addEventListener('yt-navigate-finish', () => {
    const current = hasYouTubeTranscript();

    lastTranscriptState = current;

    browser.runtime.sendMessage({
        action: 'transcriptState',
        hasTranscript: current
    }).catch(() => {});
});

browser.runtime.sendMessage({
    action: 'transcriptState',
    hasTranscript: lastTranscriptState
}).catch(() => {});

browser.runtime.onMessage.addListener(
    (message) => {
        switch (message.action) {

        case 'hasSelection':
            return Promise.resolve({
                hasSelection:
                    !window.getSelection()
                        .isCollapsed,
                hasTranscript:
                    window.location.hostname.includes('youtube.com') &&
                    [...document.querySelectorAll('button')].some(
                        button =>
                            button.getAttribute('aria-label') ===
                            'Показать текст видео'
                    )
            });

        case 'copyTranscript': {
            let text = zimclip.getYouTubeTranscript();

            if (text) {
                return Promise.resolve({text});
            }

            const button = [
                ...document.querySelectorAll('button')
            ].find(
                button =>
                    button.getAttribute('aria-label') ===
                    'Показать текст видео'
            );

            if (button) {
                button.click();
            }

            return new Promise(resolve => {
                const observer = new MutationObserver(() => {
                    const text =
                        zimclip.getYouTubeTranscript();

                    if (!text) {
                        return;
                    }

                    observer.disconnect();
                    clearTimeout(timeout);

                    resolve({text});
                });

                const timeout = setTimeout(() => {
                    observer.disconnect();
                    resolve({text: ''});
                }, 10000);

                observer.observe(
                    document.documentElement,
                    {
                        childList: true,
                        subtree: true,
                        characterData: true
                    }
                );

                const text =
                    zimclip.getYouTubeTranscript();

                if (text) {
                    observer.disconnect();
                    clearTimeout(timeout);

                    resolve({text});
                }
            });
        }

        case 'metas':
            return zimclip.getMetas();

        case 'html2wiki':
            return zimclip.html2Wiki(
                message.name
            );

        default:
            return undefined;
        }
    }
);
