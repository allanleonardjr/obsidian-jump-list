# Obsidian Jump List

Quickly jump to your last 10 opened files using keyboard shortcuts, statusbar menu, or sidebar view. Perfect for power users who want fast file navigation without breaking their workflow.

**Desktop only** - Optimized for keyboard-driven workflows on Windows, macOS, and Linux.

## Features

### 🚀 Quick Navigation
- **Alt+1 through Alt+0** - Jump directly to any of your last 10 files
- **Alt+← / Alt+→** - Navigate backward and forward through your file history
- **Statusbar dropdown** - Click the statusbar to see all recent files with their shortcuts
- **Sidebar pane** - Visual list of recent files with clickable items

### 🎯 Smart History Management
- Automatically tracks your last 10 opened files
- Preserves history order when navigating (doesn't reorder on Alt+arrow or Alt+#)
- Only updates history when you manually open files
- Auto-cleans deleted or renamed files from history
- Switches to existing tabs instead of opening duplicates

### 💡 Visual Feedback
- Sidebar highlights the currently active file
- Statusbar shows current count (e.g., "📁 Jump List (7/10)")
- Hotkey hints reflect your custom keyboard shortcuts
- Delete buttons to remove files from history

## Usage

### Keyboard Shortcuts

1. **Jump to specific file**: Press `Alt+1` through `Alt+0` to jump to files 1-10 in your history
2. **Navigate history**: Use `Alt+Left Arrow` to go back, `Alt+Right Arrow` to go forward
3. **View history**: Click the statusbar item to see a dropdown menu with all recent files

### Sidebar View

1. Click the ribbon icon (history icon) to toggle the sidebar
2. Click any file in the sidebar to open it
3. Click the 🗑️ icon to remove a file from history
4. Click "🔄 Refresh List" to clean up deleted/renamed files

### Statusbar Menu

Click the statusbar item showing "📁 Jump List (X/10)" to see:
- Numbered list of all recent files
- Hotkey shortcuts for each file
- Option to refresh the list

## Installation

### From Obsidian

1. Open Settings → Community plugins
2. Click "Browse" and search for "Obsidian Jump List"
3. Click "Install" then "Enable"

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/allanleonardjr/obsidian-jump-list/releases)
2. Extract the files to your vault's `.obsidian/plugins/obsidian-jump-list/` folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community plugins

## Customization

### Keyboard Shortcuts

You can customize all keyboard shortcuts in Settings → Hotkeys:
- Search for "Jump List" to find all commands
- Remap `Alt+1` through `Alt+0` to your preferred keys
- Change `Alt+Left` and `Alt+Right` to different navigation keys

The sidebar and statusbar will automatically reflect your custom hotkey bindings.

## How It Works

- **History Tracking**: The plugin tracks files as you open them, maintaining a list of the last 10 files
- **Smart Navigation**: When using Alt+arrows or Alt+#, the history order is preserved (files don't move to position 1)
- **Tab Management**: If a file is already open in a tab, clicking it switches to that tab instead of opening a duplicate
- **Auto-Cleanup**: Deleted or renamed files are automatically removed from history

## Development

### First Time Setup

```bash
git clone https://github.com/allanleonardjr/obsidian-jump-list.git
cd obsidian-jump-list
pnpm install
pnpm run dev
```

### Building

```bash
pnpm run build
```

This will create `main.js` in the project root.


### Project Structure

```
obsidian-jump-list/
├── main.ts          # Plugin entry point and core logic
├── styles.css       # Plugin styles
├── manifest.json    # Plugin manifest
├── versions.json    # Version compatibility
└── README.md        # This file
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Support

If you encounter any issues or have feature requests, please [open an issue](https://github.com/allanleonardjr/obsidian-jump-list/issues) on GitHub.

## License

MIT License - see LICENSE file for details

## Author

**JR Leonard**
- Email: AllanLeonardJr@gmail.com

---

Made with ❤️ for the Obsidian community
