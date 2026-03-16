import AppState from './state.js';
import { renderTabs, switchToTab } from './tabs.js';
import { renderPreview } from './preview.js';
import { renderRecent } from './sidebar.js';

const { invoke } = window.__TAURI__.core;
const { readTextFile, writeTextFile } = window.__TAURI__.fs;
const { open, save, ask } = window.__TAURI__.dialog;

function getFileName(filePath) {
  return filePath.split('/').pop().split('\\').pop();
}

export async function openFile(filePath) {
  // If no path given, show dialog
  if (!filePath) {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] }]
    });
    if (!selected) return;
    filePath = selected;
  }

  // Check if already open in a tab
  const existing = AppState.tabs.find(t => t.filePath === filePath);
  if (existing) {
    switchToTab(existing.id);
    return;
  }

  // Read file
  let content;
  try {
    content = await readTextFile(filePath);
  } catch (e) {
    console.error('Failed to read file:', e);
    return;
  }

  // Create tab
  const tab = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    filePath,
    fileName: getFileName(filePath),
    content,
    isDirty: false
  };
  AppState.tabs.push(tab);
  renderTabs();
  switchToTab(tab.id);

  // Add to recent files
  addToRecent(filePath);
}

export function createNew() {
  const num = AppState.nextUntitledNum++;
  const tab = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    filePath: null,
    fileName: `Untitled-${num}.md`,
    content: '',
    isDirty: false
  };
  AppState.tabs.push(tab);
  renderTabs();
  switchToTab(tab.id);
}

export async function saveFile(tabId) {
  const tab = AppState.tabs.find(t => t.id === tabId);
  if (!tab) return;

  // Get current content from editor if this is the active tab
  if (tabId === AppState.activeTabId) {
    tab.content = document.getElementById('editor').value;
  }

  // If no file path, show save dialog
  if (!tab.filePath) {
    const path = await save({
      defaultPath: tab.fileName,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (!path) return;
    tab.filePath = path;
    tab.fileName = getFileName(path);
  }

  try {
    await writeTextFile(tab.filePath, tab.content);
    tab.isDirty = false;
    renderTabs();
    addToRecent(tab.filePath);
  } catch (e) {
    console.error('Failed to save file:', e);
  }
}

export async function closeTab(tabId) {
  const tab = AppState.tabs.find(t => t.id === tabId);
  if (!tab) return;

  if (tab.isDirty) {
    const shouldSave = await ask('Save changes before closing?', {
      title: 'Unsaved Changes',
      kind: 'warning'
    });
    if (shouldSave) {
      await saveFile(tabId);
    }
  }

  // Remove tab
  const idx = AppState.tabs.findIndex(t => t.id === tabId);
  AppState.tabs.splice(idx, 1);

  // Clear auto-save timer
  if (AppState.autoSaveTimers[tabId]) {
    clearTimeout(AppState.autoSaveTimers[tabId]);
    delete AppState.autoSaveTimers[tabId];
  }

  // Switch to another tab or create new
  if (AppState.tabs.length === 0) {
    createNew();
  } else if (AppState.activeTabId === tabId) {
    const newIdx = Math.min(idx, AppState.tabs.length - 1);
    switchToTab(AppState.tabs[newIdx].id);
  }

  renderTabs();

  // Persist session so closed tab is removed from cache
  await saveSession();
}

function addToRecent(filePath) {
  // Remove if already in list, then add to front
  AppState.recentFiles = AppState.recentFiles.filter(f => f !== filePath);
  AppState.recentFiles.unshift(filePath);
  if (AppState.recentFiles.length > 20) {
    AppState.recentFiles = AppState.recentFiles.slice(0, 20);
  }
  renderRecent();
  persistRecent();
}

export function removeFromRecent(filePath) {
  AppState.recentFiles = AppState.recentFiles.filter(f => f !== filePath);
  renderRecent();
  persistRecent();
}

export async function loadRecent() {
  try {
    AppState.recentFiles = await invoke('get_recent_files');
  } catch (e) {
    AppState.recentFiles = [];
  }
  renderRecent();
}

async function persistRecent() {
  try {
    await invoke('save_recent_files', { files: AppState.recentFiles });
  } catch (e) {
    console.error('Failed to persist recent files:', e);
  }
}

// --- Session persistence (Sublime-style) ---

export async function saveSession() {
  // Sync current editor content to active tab
  if (AppState.activeTabId) {
    const tab = AppState.tabs.find(t => t.id === AppState.activeTabId);
    if (tab) {
      tab.content = document.getElementById('editor').value;
    }
  }

  const session = {
    tabs: AppState.tabs.map(t => ({
      id: t.id,
      filePath: t.filePath,
      fileName: t.fileName,
      content: t.content,
      isDirty: t.isDirty
    })),
    activeTabId: AppState.activeTabId,
    nextUntitledNum: AppState.nextUntitledNum
  };

  try {
    await invoke('save_session', { session: JSON.stringify(session) });
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

export async function restoreSession() {
  try {
    const raw = await invoke('get_session');
    if (!raw || raw === 'null') return false;

    const session = JSON.parse(raw);
    if (!session || !session.tabs || session.tabs.length === 0) return false;

    AppState.tabs = session.tabs;
    AppState.activeTabId = session.activeTabId;
    AppState.nextUntitledNum = session.nextUntitledNum || 1;

    // Re-read content for tabs that have a filePath (file may have changed externally)
    for (const tab of AppState.tabs) {
      if (tab.filePath) {
        try {
          const freshContent = await readTextFile(tab.filePath);
          if (!tab.isDirty) {
            tab.content = freshContent;
          }
        } catch (e) {
          // File may have been deleted; keep cached content
        }
      }
    }

    renderTabs();
    if (AppState.activeTabId) {
      const { switchToTab } = await import('./tabs.js');
      switchToTab(AppState.activeTabId);
    }

    return true;
  } catch (e) {
    console.error('Failed to restore session:', e);
    return false;
  }
}

export async function clearTabFromSession(tabId) {
  // After explicitly closing a tab (user chose not to save), persist updated session
  await saveSession();
}
