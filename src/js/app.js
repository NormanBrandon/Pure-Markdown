import AppState from './state.js';
import { openFile, createNew, saveFile, closeTab, loadRecent, saveSession, restoreSession } from './fileops.js';
import { initEditor } from './editor.js';

const { listen } = window.__TAURI__.event;

async function init() {
  // Initialize editor (input handlers, splitter)
  initEditor();

  // Load recent files from disk
  await loadRecent();

  // Restore previous session (Sublime-style)
  const restored = await restoreSession();

  // Listen for file-open events (macOS Finder double-click, CLI args)
  await listen('open-file', (event) => {
    openFile(event.payload);
  });

  // Check CLI arguments
  try {
    const cli = window.__TAURI__.cli;
    if (cli) {
      const matches = await cli.getMatches();
      if (matches.args.file && matches.args.file.value) {
        await openFile(matches.args.file.value);
      }
    }
  } catch (e) {
    // No CLI args, that's fine
  }

  // If no tabs were opened (no session, no CLI), create an empty one
  if (AppState.tabs.length === 0) {
    createNew();
  }

  // Sidebar buttons
  document.getElementById('btn-new').addEventListener('click', createNew);
  document.getElementById('btn-open').addEventListener('click', () => openFile());
  document.getElementById('btn-new-tab').addEventListener('click', createNew);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'o') {
      e.preventDefault();
      openFile();
    }
    if (mod && e.key === 's') {
      e.preventDefault();
      saveFile(AppState.activeTabId);
    }
    if (mod && e.key === 'n') {
      e.preventDefault();
      createNew();
    }
    if (mod && e.key === 'w') {
      e.preventDefault();
      closeTab(AppState.activeTabId);
    }
  });

  // Save session when app is about to close
  window.addEventListener('beforeunload', () => {
    saveSession();
  });

  // Also save session periodically (every 30s) as safety net
  setInterval(() => {
    saveSession();
  }, 30000);
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
