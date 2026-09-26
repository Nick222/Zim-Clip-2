# Zim Clip — Zim Plugin

This directory contains the Zim plugin used by Zim-Clip-2.

The plugin provides the Zim-side integration for the browser extension's Mark and Clip operations.

## Requirements

The plugin is designed for Zim and is currently developed and tested with the Linux version of Zim used by the Zim-Clip-2 project.

The Chromium extension and native messaging host are required for browser integration.

## Installation

Copy the `zimclip` directory to the Zim user plugin directory:

```text
~/.local/share/zim/plugins/zimclip/
```

Then enable **Zim Clip** in Zim's plugin settings.

The plugin is configured per notebook.

## Configuration

The plugin provides separate settings for Mark and Clip.

### Mark

**Mark default location**

Defines the Zim section under which pages created by Mark are placed.

The browser extension selects the notebook. The Zim plugin determines where the new Mark page is created inside that notebook.

### Clip

**Clip default location**

Defines the Zim page used as the default destination for Clip in the selected notebook.

The browser extension does not select a Zim page. It selects the notebook, while the Zim plugin keeps the notebook-specific destination.

## Operation

When Clip is sent to Zim, the native messaging host opens or activates the selected notebook in the Zim GUI.

The Clip operation is then performed using the notebook and page objects belonging to the GUI process. This keeps the visible Zim state synchronized with the stored page.

When Clip is configured for the system clipboard, the Zim plugin is not involved.

## Mark and Clip

### Mark

Creates a new Zim page based on the current web page.

### Clip

Copies text selected on the current web page to the configured Clip default location.

The text and metadata are prepared by the Chromium extension before the Zim plugin receives them.

## Notebook-specific configuration

Mark and Clip notebook selection is independent.

A browser user can select one notebook for Mark and another notebook for Clip.

Each notebook can have its own Mark default location and Clip default location.

## License and origin

This plugin is part of Zim-Clip-2, a substantially modified version of the original `zim-clip` project by Rui Nibau.

The original project was released under the GNU General Public License v3.0 only.

The modifications and additions in this version were made by Nick. Original copyright and license information is retained.

See the repository root [`licence.md`](../licence.md) for the applicable GPL license text.
