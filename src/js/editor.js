import AppState from './state.js';
import { renderPreview } from './preview.js';
import { saveFile, saveSession } from './fileops.js';
import { renderTabs } from './tabs.js';

const AUTO_SAVE_DELAY = 2000;

let scrollSyncSource = null; // prevents infinite scroll loop

export function initEditor() {
  const editor = document.getElementById('editor');

  // Live preview on input
  editor.addEventListener('input', () => {
    const tab = AppState.tabs.find(t => t.id === AppState.activeTabId);
    if (!tab) return;

    tab.content = editor.value;
    tab.isDirty = true;
    renderTabs();
    renderPreview(editor.value);

    // Auto-save with debounce (only if file has a path)
    if (tab.filePath) {
      if (AppState.autoSaveTimers[tab.id]) {
        clearTimeout(AppState.autoSaveTimers[tab.id]);
      }
      AppState.autoSaveTimers[tab.id] = setTimeout(() => {
        saveFile(tab.id);
      }, AUTO_SAVE_DELAY);
    }
  });

  // Update line/col and word/char counters
  editor.addEventListener('keyup', updateStatusBar);
  editor.addEventListener('click', updateStatusBar);
  editor.addEventListener('input', updateCounts);

  // Tab key inserts spaces
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      editor.dispatchEvent(new Event('input'));
    }
  });

  // Splitter drag
  initSplitter();

  // View mode toggles
  initViewToggles();

  // Scroll sync
  initScrollSync();
}

function updateStatusBar() {
  const editor = document.getElementById('editor');
  const pos = editor.selectionStart;
  const text = editor.value.substring(0, pos);
  const lines = text.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  document.getElementById('status-line-info').textContent = `Ln ${line}, Col ${col}`;
  updateCounts();
}

function updateCounts() {
  const editor = document.getElementById('editor');
  const content = editor.value;
  const chars = content.length;
  const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
  document.getElementById('status-word-count').textContent = `${words} word${words !== 1 ? 's' : ''}`;
  document.getElementById('status-char-count').textContent = `${chars} char${chars !== 1 ? 's' : ''}`;
}

export { updateCounts };

function initSplitter() {
  const splitter = document.getElementById('splitter');
  const editorPane = document.getElementById('editor-pane');
  const previewPane = document.getElementById('preview-pane');
  let isDragging = false;

  splitter.addEventListener('mousedown', (e) => {
    isDragging = true;
    splitter.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const workspace = document.getElementById('workspace');
    const rect = workspace.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    // Clamp between 15% and 85% to always keep splitter reachable
    const clamped = Math.max(0.15, Math.min(0.85, ratio));
    editorPane.style.flex = `0 0 calc(${clamped * 100}% - 2px)`;
    previewPane.style.flex = `0 0 calc(${(1 - clamped) * 100}% - 2px)`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      splitter.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

export function setView(mode) {
  const workspace = document.getElementById('workspace');
  const btnEditor = document.getElementById('btn-view-editor');
  const btnSplit = document.getElementById('btn-view-split');
  const btnPreview = document.getElementById('btn-view-preview');

  workspace.classList.remove('view-editor-only', 'view-preview-only');
  btnEditor.classList.remove('active');
  btnSplit.classList.remove('active');
  btnPreview.classList.remove('active');

  if (mode === 'editor') {
    workspace.classList.add('view-editor-only');
    btnEditor.classList.add('active');
  } else if (mode === 'preview') {
    workspace.classList.add('view-preview-only');
    btnPreview.classList.add('active');
  } else {
    // Reset pane sizes to 50/50 when returning to split view
    document.getElementById('editor-pane').style.flex = '';
    document.getElementById('preview-pane').style.flex = '';
    btnSplit.classList.add('active');
  }

  AppState.viewMode = mode;
  saveSession();
}

function initViewToggles() {
  const btnEditor = document.getElementById('btn-view-editor');
  const btnSplit = document.getElementById('btn-view-split');
  const btnPreview = document.getElementById('btn-view-preview');

  btnEditor.addEventListener('click', () => setView('editor'));
  btnSplit.addEventListener('click', () => setView('split'));
  btnPreview.addEventListener('click', () => setView('preview'));
}

function initScrollSync() {
  const editor = document.getElementById('editor');
  const previewPane = document.getElementById('preview-pane');
  let scrollSyncTimer = null;

  function clearSyncLock() {
    if (scrollSyncTimer) clearTimeout(scrollSyncTimer);
    scrollSyncTimer = setTimeout(() => {
      scrollSyncSource = null;
    }, 150);
  }

  editor.addEventListener('scroll', () => {
    if (scrollSyncSource === 'preview') return;
    scrollSyncSource = 'editor';

    const maxScroll = editor.scrollHeight - editor.clientHeight;
    if (maxScroll <= 0) return;
    const ratio = editor.scrollTop / maxScroll;
    previewPane.scrollTop = ratio * (previewPane.scrollHeight - previewPane.clientHeight);

    clearSyncLock();
  });

  previewPane.addEventListener('scroll', () => {
    if (scrollSyncSource === 'editor') return;
    scrollSyncSource = 'preview';

    const maxScroll = previewPane.scrollHeight - previewPane.clientHeight;
    if (maxScroll <= 0) return;
    const ratio = previewPane.scrollTop / maxScroll;
    editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);

    clearSyncLock();
  });
}
