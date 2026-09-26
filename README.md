# Zim-Clip-2

A browser-to-Zim clipping system consisting of a Zim plugin, a Chromium browser extension, and a native messaging host connecting the browser with Zim.

## Components

### Zim plugin

The Zim plugin provides the Zim-side integration for Mark and Clip.

See [`zim-clip-zim-plugin/README.md`](zim-clip-zim-plugin/README.md).

### Chromium extension

The Chromium extension provides the browser-side interface for Mark and Clip, site-specific metadata profiles, templates, and communication with Zim.

See [`zim-clip-chromium/README.md`](zim-clip-chromium/README.md).

## How it works

### Mark

Mark creates a new Zim page based on the current web page.

The page metadata is read from the current web page and processed through a site profile when one is available.

### Clip

Clip works with text selected on the current web page.

The selected content can be sent either:

* to a configured Clip location in Zim; or
* to the system clipboard.

The browser extension selects the target Zim notebook. The Zim plugin defines the Clip default location for each notebook.

### Site profiles

Site profiles provide site-specific metadata extraction and normalization.

The same profile data can be used by both Mark and Clip. Profiles may define fields such as:

* title
* URL
* author
* date
* publisher
* description
* keywords
* other metadata supported by the profile system

Profiles are stored in `zim-clip-chromium/settings/`.

The repository includes several working profiles as examples. Additional profiles can be added as new site-specific requirements are encountered.

The helper script `zim-clip-chromium/tools/zimclip_metadata.py` is provided to help create metadata/profile data for new types of sites.

## Deliberate limitations

The current design intentionally does not provide a "Mark All" operation.

Mark and Clip act only on the current browser page. Clip acts only on content explicitly selected by the user.

This avoids accidentally processing unrelated, private, financial, or otherwise sensitive tabs and avoids the resource usage associated with processing many browser tabs at once.

Site-specific metadata extraction depends on the corresponding site profile. A web site can change its HTML structure and may therefore require its profile to be updated.

The current native messaging integration is designed for a Linux/Zim environment. The included installation scripts and native host configuration are currently Linux-oriented.

## Architecture

```text
Browser page
     │
     ├── Mark ───────────────┐
     │                       │
     └── Clip ───────────────┤
                             ▼
                     Site profile
                             │
                    normalized metadata
                             │
                     template processing
                             │
                   ┌─────────┴─────────┐
                   │                   │
                  Zim              Clipboard
                   │
             selected notebook
                   │
          Zim plugin settings
                   │
         default destination page
```

## Project origin

Zim-Clip-2 is a substantially modified version of the original `zim-clip` project by Rui Nibau.

The original `zim-clip` was released under the GNU General Public License v3.0 only (GPL-3.0-only).

This version contains substantial modifications and additions by Nick, including the Chromium implementation, redesigned Mark and Clip workflows, site profiles, the native messaging host, and integration with the Zim GUI.

Copyright and license notices belonging to the original project are retained. Nick is the author of the modifications and additions made in this version.

This repository does not claim the original work of Rui Nibau as work by Nick.

## Third-party components

The repository contains third-party components under their respective licenses.

Their original copyright and license notices are retained in the corresponding source files.

The current third-party components include code distributed under the Mozilla Public License 2.0 and MIT License.

## License

The applicable license for the GPL-covered portions of this project is the GNU General Public License v3.0 only.

The full license text is provided in [`licence.md`](licence.md).

Third-party components remain subject to their respective licenses.
