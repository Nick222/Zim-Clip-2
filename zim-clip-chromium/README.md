# Zim Clip — Chromium

A Chromium browser extension for sending web-page information and selected content to Zim.

The extension is part of Zim-Clip-2 and works together with the Zim plugin and native messaging host included in this repository.

## Features

### Mark

Creates a new Zim page based on the current web page.

Mark uses the current page's metadata and the configured Mark template.

### Clip

Copies text selected on the current web page.

Clip supports two destinations:

* **Zim default location** — sends the content to the selected Clip notebook in Zim;
* **Clipboard** — sends the content directly to the system clipboard without using Zim.

### Site profiles

The extension supports site-specific profiles stored in:

```text
settings/
```

Profiles provide normalized metadata used by Mark and Clip.

Supported metadata can include:

```text
title
url
author
date
modified
publisher
description
keywords
type
image
```

Profiles can be added or modified when a particular web site requires special handling.

The helper:

```text
tools/zimclip_metadata.py
```

is provided to help create metadata/profile data for new site types.

### Templates

Mark and Clip use separate templates.

Clip templates can use page properties and selected content, for example:

```text
${page.selection} (${page.publisher}, [[${page.url}|${page.title}]], ${page.author}, ${page.date})
```

The available page properties are documented directly in the extension's Options page.

## Installation

### 1. Install the Zim plugin

Install and enable the Zim plugin from:

```text
../zim-clip-zim-plugin/
```

See:

```text
../zim-clip-zim-plugin/README.md
```

### 2. Load the Chromium extension

Open:

```text
chrome://extensions
```

Enable **Developer mode**.

Choose **Load unpacked** and select this directory:

```text
zim-clip-chromium/
```

The extension uses the fixed extension identity defined by `manifest.json`.

The extension ID used by the native messaging host is stored in:

```text
EXTENSION_ID
```

The ID must correspond to the extension ID used by the Native Messaging manifest.

### 3. Install the native messaging host

From this directory run:

```bash
./native/install-native-host.sh
```

The native host connects Chromium to the Zim executable.

The host handles:

* Mark requests;
* Clip-to-Zim requests;
* Clip-to-Clipboard requests;
* the notebook list used by the extension settings.

### 4. Configure the extension

Open the extension Options page.

Configure:

* Mark notebook;
* Mark template;
* Clip notebook;
* Clip destination;
* Clip template;
* Wiki syntax.

The **Clip destination** can be either:

```text
Zim default location
Clipboard
```

When Zim is selected, the destination page itself is configured in the Zim plugin for the selected notebook.

## Site profiles

Profile files are named after their host names:

```text
settings/<hostname>.json
```

For example:

```text
settings/naked-science_ru.json
```

The extension automatically loads the profile corresponding to the current web site when one exists.

A profile can define how metadata such as author, publication date, and publisher are extracted from the page.

Sites without a dedicated profile use the generic metadata extraction mechanism.

## Deliberate limitations

The extension does not contain a "Mark All" operation.

Mark and Clip operate only on the current browser page.

Clip processes only content explicitly selected by the user.

There is no background processing of all open tabs. This is deliberate: it prevents accidental collection of unrelated or sensitive pages and avoids the resource consumption associated with mass processing.

Site profiles depend on the current HTML and metadata structure of a web site. Changes made by a site can require its profile to be updated.

The current native host installation is Linux-oriented.

## Architecture

```text
Chromium
   │
   ├── Mark
   │
   └── Clip
         │
         ▼
    site profile
         │
         ▼
     template
         │
    ┌────┴────┐
    │         │
   Zim    Clipboard
    │
 native messaging
    │
 Zim GUI + Zim plugin
```

## Project origin

This Chromium extension is part of Zim-Clip-2, a substantially modified version of the original `zim-clip` project by Rui Nibau.

The original project was released under the GNU General Public License v3.0 only.

This version contains substantial modifications and additions by Nick, including the Chromium implementation, redesigned Mark and Clip workflows, site profiles, and the native messaging integration with the Zim GUI.

Original copyright and license information is retained. Nick is the author of the modifications and additions in this version.

## Third-party code

The extension contains third-party components which remain under their original licenses.

In particular:

* `thirdparty/browser-polyfill.js` — Mozilla Public License 2.0;
* `thirdparty/date.format.js` — MIT License.

Their original license and copyright notices are retained.

## License

The GPL-covered portions of this project are distributed under the GNU General Public License v3.0 only.

See the repository root [`../licence.md`](../licence.md) for the full license text.
