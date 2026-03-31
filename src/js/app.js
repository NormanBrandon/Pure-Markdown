import AppState from './state.js';
import { openFile, createNew, saveFile, closeTab, loadRecent, saveSession, restoreSession } from './fileops.js';
import { initEditor, setView, zoomIn, zoomOut, zoomReset } from './editor.js';

function toggleSidebar(forceState) {
  const sidebar = document.getElementById('sidebar');
  const showBtn = document.getElementById('btn-sidebar-show');
  const collapsed = forceState !== undefined ? forceState : !sidebar.classList.contains('collapsed');
  sidebar.classList.toggle('collapsed', collapsed);
  showBtn.classList.toggle('visible', collapsed);
  localStorage.setItem('sidebar-collapsed', collapsed);
}

function restoreSidebar() {
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    toggleSidebar(true);
  }
}

const { listen } = window.__TAURI__.event;
const { invoke } = window.__TAURI__.core;

async function init() {
  // Initialize editor (input handlers, splitter)
  initEditor();

  // Restore sidebar state
  restoreSidebar();

  // Sidebar toggle buttons
  document.getElementById('btn-sidebar-hide').addEventListener('click', () => toggleSidebar(true));
  document.getElementById('btn-sidebar-show').addEventListener('click', () => toggleSidebar(false));

  // Load recent files from disk
  await loadRecent();

  // Restore previous session (Sublime-style)
  const restored = await restoreSession();

  // Listen for file-open events (macOS Finder double-click while app is running)
  await listen('open-file', (event) => {
    openFile(event.payload);
  });

  // Check if a file was passed at launch (CLI arg or file association on cold start)
  try {
    const initialFile = await invoke('get_initial_file');
    if (initialFile) {
      await openFile(initialFile);
    }
  } catch (e) {
    // No initial file, that's fine
  }

  // If no tabs were opened (no session, no CLI), create an empty one
  if (AppState.tabs.length === 0) {
    createNew();
  }

  // Sidebar buttons
  document.getElementById('btn-new').addEventListener('click', createNew);
  document.getElementById('btn-open').addEventListener('click', () => openFile());
  document.getElementById('btn-new-tab').addEventListener('click', createNew);

  // Global keyboard shortcuts
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
    // Toggle sidebar: Cmd/Ctrl+\
    if (mod && e.key === '\\') {
      e.preventDefault();
      toggleSidebar();
    }
    // Zoom: Cmd/Ctrl + / - / 0
    if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      zoomIn();
    }
    if (mod && e.key === '-') {
      e.preventDefault();
      zoomOut();
    }
    if (mod && e.key === '0') {
      e.preventDefault();
      zoomReset();
    }
    // View mode: Ctrl/Cmd+1/2/3
    if (mod && e.key === '1') {
      e.preventDefault();
      setView('editor');
    }
    if (mod && e.key === '2') {
      e.preventDefault();
      setView('split');
    }
    if (mod && e.key === '3') {
      e.preventDefault();
      setView('preview');
    }
  });

  // Handle native menu events from Tauri
  await listen('menu-event', (event) => {
    const id = event.payload;
    const editor = document.getElementById('editor');
    // Dispatch a synthetic keydown to reuse existing shortcut logic
    const dispatch = (key, opts = {}) => {
      editor.focus();
      editor.dispatchEvent(new KeyboardEvent('keydown', {
        key, bubbles: true, cancelable: true,
        ctrlKey: true, metaKey: true, ...opts
      }));
    };
    switch (id) {
      case 'new': createNew(); break;
      case 'open': openFile(); break;
      case 'save': saveFile(AppState.activeTabId); break;
      case 'close-tab': closeTab(AppState.activeTabId); break;
      case 'undo': dispatch('z'); break;
      case 'redo': dispatch('y'); break;
      case 'bold': dispatch('b'); break;
      case 'italic': dispatch('i'); break;
      case 'inline-code': dispatch('e'); break;
      case 'code-block': dispatch('E', { shiftKey: true }); break;
      case 'link': dispatch('k'); break;
      case 'image': dispatch('K', { shiftKey: true }); break;
      case 'select-line': dispatch('l'); break;
      case 'duplicate-line': dispatch('d'); break;
      case 'move-line-up': dispatch('ArrowUp', { shiftKey: true }); break;
      case 'move-line-down': dispatch('ArrowDown', { shiftKey: true }); break;
      case 'toggle-sidebar': toggleSidebar(); break;
      case 'view-editor': setView('editor'); break;
      case 'view-split': setView('split'); break;
      case 'view-preview': setView('preview'); break;
      case 'zoom-in': zoomIn(); break;
      case 'zoom-out': zoomOut(); break;
      case 'zoom-reset': zoomReset(); break;
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
