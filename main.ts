import { Plugin, TFile, Menu, ItemView, WorkspaceLeaf, Notice } from 'obsidian';

/**
 * Jump List View - Custom sidebar pane displaying recent files
 */
class JumpListView extends ItemView {
	private plugin: JumpListPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: JumpListPlugin) {
		super(leaf);
		this.plugin = plugin;
		// Register this view with the plugin so it can be refreshed
		this.plugin.registerSidebarView(this);
	}

	/**
	 * Returns the view type identifier
	 * @returns {string} View type identifier
	 */
	getViewType(): string {
		return 'jump-list-view';
	}

	/**
	 * Returns the display name shown in the sidebar
	 * @returns {string} Display name
	 */
	getDisplayText(): string {
		return 'Jump List';
	}

	/**
	 * Returns the icon for the sidebar view
	 * @returns {string} Icon name
	 */
	getIcon(): string {
		return 'history';
	}

	/**
	 * Called when the view is opened - renders the file list
	 */
	async onOpen(): Promise<void> {
		this.render();
		// Auto-refresh sidebar every 5 seconds
		this.registerInterval(window.setInterval(() => this.render(), 5000));
	}

	/**
	 * Called when the view is closed - cleanup
	 */
	async onClose(): Promise<void> {
		// Unregister this view from the plugin
		this.plugin.unregisterSidebarView(this);
	}

	/**
	 * Public method to refresh the view (called by plugin when history changes)
	 */
	refresh(): void {
		this.render();
	}

	/**
	 * Renders the clickable numbered list from plugin.recentFiles
	 */
	private render(): void {
		// Get the content container - Obsidian ItemView uses contentEl
		const contentEl = (this as any).contentEl;
		if (!contentEl) {
			console.error('[Jump List] contentEl not found!');
			return;
		}
		
		// Clear existing content
		contentEl.empty();
		
		// Create the main wrapper
		const wrapper = contentEl.createDiv('sidebar-jump-list');

		// Add title at the top
		const title = wrapper.createDiv('jump-list-title');
		title.setText('Jump List');

		// Get the files array
		const files = this.plugin.recentFiles || [];
		const fileCount = files.length;
		
		console.log('[Jump List] Rendering sidebar - fileCount:', fileCount);
		console.log('[Jump List] Files array:', files);

		if (fileCount === 0) {
			const empty = wrapper.createDiv('jump-list-empty');
			empty.setText('No recent files');
			return;
		}

		// Render ALL files - use forEach to ensure all are rendered
		files.forEach((filePath: string, index: number) => {
			if (!filePath || typeof filePath !== 'string') {
				console.warn('[Jump List] Invalid filePath at index', index, ':', filePath);
				return;
			}
			
			const item = wrapper.createDiv('jump-list-item');
			
			// Check if this is the active/selected file (when navigating)
			const isActive = this.plugin.historyIndex >= 0 && this.plugin.historyIndex === index;
			if (isActive) {
				item.addClass('is-active');
			}
			
			// Also check if this is the currently open file
			const currentFile = this.app.workspace.getActiveFile();
			if (currentFile && currentFile.path === filePath && this.plugin.historyIndex === -1) {
				item.addClass('is-active');
			}
			
			// Number (1-10) - index 0 is position 1
			const number = item.createSpan('jump-list-item-number');
			number.setText(`${index + 1}.`);

			// Main content area (filename + actions)
			const contentArea = item.createDiv('jump-list-item-content');

			// File name - clickable, same behavior as statusbar
			const name = contentArea.createSpan('jump-list-item-name');
			const fileName = filePath.split('/').pop() || filePath;
			name.setText(fileName);
			name.setAttr('title', filePath);

			// Actions row (delete button + hotkey)
			const actionsRow = contentArea.createDiv('jump-list-item-actions');
			
			// Hotkey hint - get actual hotkey from Obsidian settings
			const hotkey = actionsRow.createSpan('jump-list-item-hotkey');
			// Try both with and without plugin prefix
			const baseCommandId = index < 9 ? `jump-file-${index + 1}` : 'jump-file-10';
			const commandIdWithPrefix = `obsidian-jump-list:${baseCommandId}`;
			let hotkeyString = this.plugin.getHotkeyForCommand(commandIdWithPrefix);
			if (!hotkeyString) {
				hotkeyString = this.plugin.getHotkeyForCommand(baseCommandId);
			}
			if (hotkeyString) {
				hotkey.setText(`[${hotkeyString}]`);
			} else {
				// Fallback to default if no hotkey found
				if (index < 9) {
					hotkey.setText(`[Alt+${index + 1}]`);
				} else {
					hotkey.setText('[Alt+0]');
				}
			}

			// Delete button
			const deleteBtn = actionsRow.createSpan('jump-list-item-delete');
			deleteBtn.setText('🗑️');
			deleteBtn.setAttr('title', 'Remove from jump list history');
			deleteBtn.onClickEvent((e) => {
				e.stopPropagation();
				e.preventDefault();
				this.plugin.removeFileFromHistory(filePath);
			});

			// Click on item (excluding delete button) to open file - same as statusbar
			item.onClickEvent(async (e) => {
				// Don't trigger if clicking delete button
				if ((e.target as HTMLElement).classList.contains('jump-list-item-delete')) {
					return;
				}
				// Set history index to show this file as active immediately
				this.plugin.historyIndex = index;
				// Refresh sidebar immediately to show active state
				this.render();
				// Then open the file (this will trigger file-open event)
				await this.plugin.openFileOrSwitchToTab(filePath);
				// Refresh sidebar again after file opens to ensure correct state
				setTimeout(() => {
					this.render();
				}, 150);
			});
		});

		// Divider
		wrapper.createDiv('jump-list-divider');

		// Refresh button
		const refreshBtn = wrapper.createDiv('jump-list-item');
		refreshBtn.setText('🔄 Refresh List');
		refreshBtn.onClickEvent(() => {
			this.plugin.refreshRecentFiles();
			// Plugin will refresh sidebar via refreshSidebarViews()
		});
	}
}

/**
 * Obsidian Jump List Plugin
 * 
 * Provides quick access to the last 10 opened files via:
 * - Statusbar dropdown menu
 * - Alt+1 through Alt+0 hotkeys
 * - Alt+Left/Right arrow navigation
 * - Right sidebar pane
 * - Mobile-friendly interface
 */
export default class JumpListPlugin extends Plugin {
	/** File paths of recent files, max 10 items */
	recentFiles: string[] = [];

	/** Maximum number of files to keep in history */
	private readonly MAX_HISTORY = 10;

	/** Current position in history for Alt+arrow navigation */
	historyIndex = -1;

	/** Flag to prevent reordering when navigating via arrows */
	private isNavigating = false;

	/** Statusbar element displaying jump list info */
	private statusBarItemEl: HTMLElement;

	/** Array of registered sidebar views that need to be refreshed */
	private sidebarViews: JumpListView[] = [];

	/**
	 * Register a sidebar view for refresh notifications
	 * @param {JumpListView} view - The sidebar view to register
	 */
	registerSidebarView(view: JumpListView): void {
		this.sidebarViews.push(view);
	}

	/**
	 * Unregister a sidebar view
	 * @param {JumpListView} view - The sidebar view to unregister
	 */
	unregisterSidebarView(view: JumpListView): void {
		const index = this.sidebarViews.indexOf(view);
		if (index > -1) {
			this.sidebarViews.splice(index, 1);
		}
	}

	/**
	 * Refresh all open sidebar views
	 */
	private refreshSidebarViews(): void {
		this.sidebarViews.forEach((view) => {
			view.refresh();
		});
	}

	/**
	 * Get the hotkey string for a command ID
	 * @param {string} commandId - The command ID to get hotkeys for
	 * @returns {string} Formatted hotkey string (e.g., "Alt+1" or "Ctrl+Shift+1")
	 */
	getHotkeyForCommand(commandId: string): string {
		try {
			// Try multiple ways to access hotkeys
			const app = this.app as any;
			
			// Method 1: Try hotkeyManager.getHotkeys
			if (app.hotkeyManager && typeof app.hotkeyManager.getHotkeys === 'function') {
				const hotkeys = app.hotkeyManager.getHotkeys(commandId);
				if (hotkeys && hotkeys.length > 0) {
					return this.formatHotkey(hotkeys[0]);
				}
			}
			
			// Method 2: Try through commands registry
			if (app.commands) {
				const command = app.commands.commands[commandId];
				if (command && command.hotkeys && command.hotkeys.length > 0) {
					return this.formatHotkey(command.hotkeys[0]);
				}
			}
			
			// Method 3: Try hotkeyManager.customKeys
			if (app.hotkeyManager && app.hotkeyManager.customKeys) {
				const customKeys = app.hotkeyManager.customKeys[commandId];
				if (customKeys && customKeys.length > 0) {
					return this.formatHotkey(customKeys[0]);
				}
			}
			
			return '';
		} catch (error) {
			console.warn('[Jump List] Error getting hotkey for command:', commandId, error);
			return '';
		}
	}

	/**
	 * Format a hotkey object into a string
	 * @param {any} hotkey - Hotkey object with modifiers and key
	 * @returns {string} Formatted hotkey string
	 */
	private formatHotkey(hotkey: any): string {
		if (!hotkey) {
			return '';
		}

		const modifiers = hotkey.modifiers || [];
		const key = hotkey.key || '';

		// Format modifiers (Ctrl, Alt, Shift, Meta)
		const modifierMap: Record<string, string> = {
			Mod: navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl',
			Ctrl: 'Ctrl',
			Alt: 'Alt',
			Shift: 'Shift',
			Meta: 'Meta',
		};

		const modifierStrings = modifiers
			.map((m: string) => modifierMap[m] || m)
			.filter(Boolean);

		// Format key (handle special keys)
		let keyString = key;
		if (key === 'ArrowLeft') keyString = '←';
		else if (key === 'ArrowRight') keyString = '→';
		else if (key === 'ArrowUp') keyString = '↑';
		else if (key === 'ArrowDown') keyString = '↓';

		// Combine modifiers and key
		if (modifierStrings.length > 0) {
			return `${modifierStrings.join('+')}+${keyString}`;
		}
		return keyString;
	}

	/**
	 * Called when the plugin is loaded
	 */
	async onload(): Promise<void> {
		// Register sidebar view
		this.registerView('jump-list-view', (leaf) => new JumpListView(leaf, this));

		// Add ribbon icon to toggle sidebar
		this.addRibbonIcon('history', 'Jump List', () => {
			this.toggleSidebar();
		});

		// Create statusbar item
		this.statusBarItemEl = this.addStatusBarItem();
		this.updateStatusBar();
		this.statusBarItemEl.addClass('mod-clickable');
		this.statusBarItemEl.onClickEvent((evt) => {
			this.showStatusbarMenu(evt);
		});

		// Register event listeners
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file instanceof TFile) {
					this.onFileOpen(file);
					// Update status bar after file opens to show position
					setTimeout(() => this.updateStatusBar(), 100);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', () => {
				this.refreshRecentFiles();
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', () => {
				this.refreshRecentFiles();
			})
		);

		this.registerEvent(
			this.app.workspace.on('editor-change', () => {
				this.historyIndex = -1;
			})
		);

		// Register hotkeys: Alt+1 through Alt+0 (10 commands)
		for (let i = 1; i <= 10; i++) {
			const key = i === 10 ? '0' : i.toString();
			this.addCommand({
				id: `jump-file-${i}`,
				name: `Jump List: File ${i === 10 ? '10 (Alt+0)' : `${i} (Alt+${i})`}`,
				hotkeys: [{ modifiers: ['Alt'], key }],
				callback: () => {
					this.jumpToFile(i - 1);
				},
			});
		}

		// Register Alt+Arrow navigation
		this.addCommand({
			id: 'jump-back',
			name: 'Jump List: Back (Alt+Left)',
			hotkeys: [{ modifiers: ['Alt'], key: 'ArrowLeft' }],
			callback: () => {
				this.navigateHistory(-1);
			},
		});

		this.addCommand({
			id: 'jump-forward',
			name: 'Jump List: Forward (Alt+Right)',
			hotkeys: [{ modifiers: ['Alt'], key: 'ArrowRight' }],
			callback: () => {
				this.navigateHistory(1);
			},
		});
	}

	/**
	 * Called when the plugin is unloaded
	 */
	async onunload(): Promise<void> {
		// Cleanup handled by Obsidian
	}

	/**
	 * Add file to history front, dedupe, trim to MAX_HISTORY
	 * @param {TFile} file - The file that was opened
	 */
	onFileOpen(file: TFile): void {
		// Don't reorder history when navigating via arrows or Alt+1-0
		if (this.isNavigating) {
			return;
		}

		const filePath = file.path;
		const isInHistory = this.recentFiles.indexOf(filePath) >= 0;

		// Check if file is already open in any leaf (tab switch scenario)
		const isFileAlreadyOpen = this.app.workspace.getLeavesOfType('markdown').some(
			(leaf) => {
				const view = leaf.view;
				if (view && 'file' in view) {
					const markdownView = view as any;
					return markdownView.file?.path === file.path;
				}
				return false;
			}
		);
		
		if (isFileAlreadyOpen && isInHistory) {
			// File is already open AND in history - tab switch, keep position
			// Still refresh sidebar to show current state
			this.refreshSidebarViews();
			return;
		}

		// File is either new OR not in history yet - add/update it
		// Remove if already exists (dedupe)
		const index = this.recentFiles.indexOf(filePath);
		if (index > -1) {
			this.recentFiles.splice(index, 1);
		}

		// Add to front
		this.recentFiles.unshift(filePath);

		// Trim to MAX_HISTORY
		if (this.recentFiles.length > this.MAX_HISTORY) {
			this.recentFiles = this.recentFiles.slice(0, this.MAX_HISTORY);
		}

		// Update history index - if we were navigating, keep the index at 0 (file moved to front)
		// Otherwise reset to -1 (not navigating)
		if (this.historyIndex >= 0) {
			// Was navigating, file is now at position 0
			this.historyIndex = 0;
		} else {
			// Not navigating, reset index
			this.historyIndex = -1;
		}

		this.updateStatusBar();
		this.refreshSidebarViews();
	}

	/**
	 * Remove invalid/deleted/renamed files from history
	 */
	refreshRecentFiles(): void {
		this.recentFiles = this.recentFiles.filter((filePath) => {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			return file instanceof TFile && file.path === filePath;
		});

		this.updateStatusBar();
		this.refreshSidebarViews();
	}

	/**
	 * Open a file, switching to existing tab if already open, otherwise opening it
	 * @param {string} filePath - Path of the file to open
	 */
	async openFileOrSwitchToTab(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
		if (!file || !(file instanceof TFile)) {
			new Notice('File not found');
			this.refreshRecentFiles();
			return;
		}

		// Check if file is already open in any leaf
		const existingLeaf = this.app.workspace.getLeavesOfType('markdown').find(
			(leaf) => {
				const view = leaf.view;
				if (view && 'file' in view) {
					const markdownView = view as any;
					return markdownView.file?.path === filePath;
				}
				return false;
			}
		);

		// Set flag to prevent reordering during navigation
		this.isNavigating = true;

		if (existingLeaf) {
			// File is already open - switch to that tab
			this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
			// Update status bar to show position
			setTimeout(() => {
				this.isNavigating = false;
				this.updateStatusBar();
				this.refreshSidebarViews();
			}, 100);
		} else {
			// File is not open - open it
			await this.app.workspace.openLinkText(filePath, '', true);
			// Reset flag after a brief delay to allow file-open event to process
			setTimeout(() => {
				this.isNavigating = false;
				this.updateStatusBar();
				this.refreshSidebarViews();
			}, 100);
		}
	}

	/**
	 * Alt+Left=-1 / Alt+Right=+1 navigation through history
	 * @param {number} direction - Navigation direction (-1 for back, 1 for forward)
	 */
	navigateHistory(direction: number): void {
		if (this.recentFiles.length === 0) {
			return;
		}

		// Initialize history index if needed
		if (this.historyIndex === -1) {
			const currentFile = this.app.workspace.getActiveFile();
			if (currentFile) {
				const currentIndex = this.recentFiles.indexOf(currentFile.path);
				this.historyIndex = currentIndex >= 0 ? currentIndex : 0;
			} else {
				this.historyIndex = 0;
			}
		}

		// Navigate
		this.historyIndex += direction;

		// Clamp to valid range
		if (this.historyIndex < 0) {
			this.historyIndex = 0;
		} else if (this.historyIndex >= this.recentFiles.length) {
			this.historyIndex = this.recentFiles.length - 1;
		}

		// Open the file at history index
		const filePath = this.recentFiles[this.historyIndex];
		this.openFileOrSwitchToTab(filePath);
		// Refresh sidebar to show active file
		this.refreshSidebarViews();
	}

	/**
	 * Statusbar dropdown menu with numbered list
	 * @param {MouseEvent} evt - Optional click event for positioning on mobile
	 */
	showStatusbarMenu(evt?: MouseEvent): void {
		const menu = new Menu();

		if (this.recentFiles.length === 0) {
			menu.addItem((item) => {
				item.setTitle('No recent files');
				item.setDisabled(true);
			});
		} else {
			this.recentFiles.forEach((filePath, index) => {
				const fileName = filePath.split('/').pop() || filePath;

				menu.addItem((item) => {
					item.setTitle(`${index + 1}. ${fileName}`);
					item.setIcon('file');
					item.setSection('jump-list');
					item.onClick(async () => {
						await this.openFileOrSwitchToTab(filePath);
					});
				});
			});

			menu.addSeparator();

			menu.addItem((item) => {
				item.setTitle('Refresh List');
				item.setIcon('refresh-cw');
				item.onClick(() => {
					this.refreshRecentFiles();
				});
			});
		}

		// Use click event coordinates if available (better for mobile)
		if (evt) {
			menu.showAtPosition({
				x: evt.clientX,
				y: evt.clientY,
			});
		} else {
			// Fallback to statusbar element position
			const rect = this.statusBarItemEl.getBoundingClientRect();
			menu.showAtPosition({
				x: rect.left,
				y: rect.top - 10,
			});
		}
	}

	/**
	 * Toggle right sidebar pane
	 */
	async toggleSidebar(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType('jump-list-view');

		if (leaves.length > 0) {
			// Close sidebar
			leaves.forEach((leaf) => leaf.detach());
		} else {
			// Open sidebar
			const rightLeaf = this.app.workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: 'jump-list-view',
					active: true,
				});
			}
		}
	}

	/**
	 * Jump to file at specified index
	 * @param {number} index - Index in recentFiles array (0-9)
	 */
	private jumpToFile(index: number): void {
		if (index >= 0 && index < this.recentFiles.length) {
			// Set history index to show which file is selected
			this.historyIndex = index;
			const filePath = this.recentFiles[index];
			this.openFileOrSwitchToTab(filePath);
			// Refresh sidebar to show active file
			this.refreshSidebarViews();
		}
	}

	/**
	 * Remove file from history
	 * @param {string} filePath - Path of file to remove
	 */
	removeFileFromHistory(filePath: string): void {
		const index = this.recentFiles.indexOf(filePath);
		if (index > -1) {
			this.recentFiles.splice(index, 1);
			this.updateStatusBar();
			this.refreshSidebarViews();
		}
	}

	/**
	 * Update statusbar display with current count and position
	 */
	private updateStatusBar(): void {
		const count = this.recentFiles.length;
		const currentFile = this.app.workspace.getActiveFile();
		
		if (currentFile && this.recentFiles.length > 0) {
			const currentIndex = this.recentFiles.indexOf(currentFile.path);
			if (currentIndex >= 0) {
				// File is in history, show position (1-indexed)
				this.statusBarItemEl.setText(`📁 Jump List (${count}/${this.MAX_HISTORY}) [${currentIndex + 1}]`);
			} else {
				// File is not in history
				this.statusBarItemEl.setText(`📁 Jump List (${count}/${this.MAX_HISTORY})`);
			}
		} else {
			// No active file or no history
			this.statusBarItemEl.setText(`📁 Jump List (${count}/${this.MAX_HISTORY})`);
		}
	}
}
