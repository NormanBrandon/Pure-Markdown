import AppState from './state.js';
import { renderPreview } from './preview.js';
import { saveFile, saveSession } from './fileops.js';
import { renderTabs } from './tabs.js';

const AUTO_SAVE_DELAY = 2000;
const INDENT = '  ';

let scrollSyncSource = null; // prevents infinite scroll loop

// --- Undo/Redo stack ---
const undoStacks = {}; // tabId -> [{ value, selStart, selEnd }]
const redoStacks = {}; // tabId -> [{ value, selStart, selEnd }]

function pushUndo(tabId, editor) {
  if (!undoStacks[tabId]) undoStacks[tabId] = [];
  const stack = undoStacks[tabId];
  const snapshot = { value: editor.value, selStart: editor.selectionStart, selEnd: editor.selectionEnd };
  // Avoid duplicate consecutive snapshots
  if (stack.length > 0 && stack[stack.length - 1].value === snapshot.value) return;
  stack.push(snapshot);
  if (stack.length > 200) stack.shift();
  // Clear redo on new action
  redoStacks[tabId] = [];
}

function undo(tabId, editor) {
  const stack = undoStacks[tabId];
  if (!stack || stack.length === 0) return;
  if (!redoStacks[tabId]) redoStacks[tabId] = [];
  redoStacks[tabId].push({ value: editor.value, selStart: editor.selectionStart, selEnd: editor.selectionEnd });
  const snapshot = stack.pop();
  editor.value = snapshot.value;
  editor.selectionStart = snapshot.selStart;
  editor.selectionEnd = snapshot.selEnd;
  editor.dispatchEvent(new Event('input'));
}

function redo(tabId, editor) {
  const stack = redoStacks[tabId];
  if (!stack || stack.length === 0) return;
  if (!undoStacks[tabId]) undoStacks[tabId] = [];
  undoStacks[tabId].push({ value: editor.value, selStart: editor.selectionStart, selEnd: editor.selectionEnd });
  const snapshot = stack.pop();
  editor.value = snapshot.value;
  editor.selectionStart = snapshot.selStart;
  editor.selectionEnd = snapshot.selEnd;
  editor.dispatchEvent(new Event('input'));
}

// --- Font size zoom ---
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;
const FONT_STEP = 2;

function getCurrentFontSize() {
  const val = getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size');
  return parseInt(val) || 14;
}

export function zoomIn() {
  const size = Math.min(getCurrentFontSize() + FONT_STEP, MAX_FONT_SIZE);
  document.documentElement.style.setProperty('--editor-font-size', size + 'px');
  localStorage.setItem('editor-font-size', size);
}

export function zoomOut() {
  const size = Math.max(getCurrentFontSize() - FONT_STEP, MIN_FONT_SIZE);
  document.documentElement.style.setProperty('--editor-font-size', size + 'px');
  localStorage.setItem('editor-font-size', size);
}

export function zoomReset() {
  document.documentElement.style.setProperty('--editor-font-size', '14px');
  localStorage.setItem('editor-font-size', 14);
}

// Restore saved font size on load
function restoreFontSize() {
  const saved = localStorage.getItem('editor-font-size');
  if (saved) {
    document.documentElement.style.setProperty('--editor-font-size', saved + 'px');
  }
}

// --- Helpers for text manipulation ---

function getLineRange(text, selStart, selEnd) {
  const lineStart = text.lastIndexOf('\n', selStart - 1) + 1;
  let lineEnd = text.indexOf('\n', selEnd);
  if (lineEnd === -1) lineEnd = text.length;
  return { lineStart, lineEnd };
}

function wrapSelection(editor, before, after) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const text = editor.value;
  const selected = text.substring(start, end);

  // If already wrapped, unwrap
  if (text.substring(start - before.length, start) === before &&
      text.substring(end, end + after.length) === after) {
    editor.value = text.substring(0, start - before.length) + selected + text.substring(end + after.length);
    editor.selectionStart = start - before.length;
    editor.selectionEnd = end - before.length;
  } else {
    editor.value = text.substring(0, start) + before + selected + after + text.substring(end);
    editor.selectionStart = start + before.length;
    editor.selectionEnd = end + before.length;
  }
  editor.dispatchEvent(new Event('input'));
}

function insertAtCursor(editor, textBefore, textAfter, placeholder) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const text = editor.value;
  const selected = text.substring(start, end) || placeholder;
  editor.value = text.substring(0, start) + textBefore + selected + textAfter + text.substring(end);
  editor.selectionStart = start + textBefore.length;
  editor.selectionEnd = start + textBefore.length + selected.length;
  editor.dispatchEvent(new Event('input'));
}

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

  // Snapshot for undo before each change
  editor.addEventListener('beforeinput', () => {
    if (AppState.activeTabId) {
      pushUndo(AppState.activeTabId, editor);
    }
  });

  // Editor keyboard shortcuts
  editor.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const shift = e.shiftKey;
    const tabId = AppState.activeTabId;

    // --- Undo / Redo ---
    if (mod && !shift && e.key === 'z') {
      e.preventDefault();
      undo(tabId, editor);
      return;
    }
    if (mod && e.key === 'y') {
      e.preventDefault();
      redo(tabId, editor);
      return;
    }
    if (mod && shift && e.key === 'z') {
      e.preventDefault();
      redo(tabId, editor);
      return;
    }

    // --- Tab / Shift+Tab indent/dedent ---
    if (e.key === 'Tab' && !mod) {
      e.preventDefault();
      pushUndo(tabId, editor);
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const text = editor.value;

      if (start === end && !shift) {
        // No selection: insert indent
        editor.value = text.substring(0, start) + INDENT + text.substring(end);
        editor.selectionStart = editor.selectionEnd = start + INDENT.length;
      } else {
        // Selection spans lines: indent/dedent each line
        const { lineStart, lineEnd } = getLineRange(text, start, end);
        const block = text.substring(lineStart, lineEnd);
        let newBlock;
        if (shift) {
          newBlock = block.split('\n').map(l => l.startsWith(INDENT) ? l.slice(INDENT.length) : l.replace(/^\t/, '')).join('\n');
        } else {
          newBlock = block.split('\n').map(l => INDENT + l).join('\n');
        }
        editor.value = text.substring(0, lineStart) + newBlock + text.substring(lineEnd);
        editor.selectionStart = lineStart;
        editor.selectionEnd = lineStart + newBlock.length;
      }
      editor.dispatchEvent(new Event('input'));
      return;
    }

    // --- Shift+Backspace: dedent current line ---
    if (shift && e.key === 'Backspace' && !mod) {
      e.preventDefault();
      pushUndo(tabId, editor);
      const text = editor.value;
      const { lineStart, lineEnd } = getLineRange(text, editor.selectionStart, editor.selectionEnd);
      const line = text.substring(lineStart, lineEnd);
      if (line.startsWith(INDENT)) {
        const cursor = editor.selectionStart;
        editor.value = text.substring(0, lineStart) + line.slice(INDENT.length) + text.substring(lineEnd);
        editor.selectionStart = editor.selectionEnd = Math.max(lineStart, cursor - INDENT.length);
        editor.dispatchEvent(new Event('input'));
      }
      return;
    }

    // --- Bold: Cmd/Ctrl+B ---
    if (mod && !shift && e.key === 'b') {
      e.preventDefault();
      pushUndo(tabId, editor);
      wrapSelection(editor, '**', '**');
      return;
    }

    // --- Italic: Cmd/Ctrl+I ---
    if (mod && !shift && e.key === 'i') {
      e.preventDefault();
      pushUndo(tabId, editor);
      wrapSelection(editor, '*', '*');
      return;
    }

    // --- Inline code: Cmd/Ctrl+E ---
    if (mod && !shift && e.key === 'e') {
      e.preventDefault();
      pushUndo(tabId, editor);
      wrapSelection(editor, '`', '`');
      return;
    }

    // --- Code block: Cmd/Ctrl+Shift+E ---
    if (mod && shift && e.key === 'E') {
      e.preventDefault();
      pushUndo(tabId, editor);
      insertAtCursor(editor, '```\n', '\n```', 'code');
      return;
    }

    // --- Link: Cmd/Ctrl+K ---
    if (mod && !shift && e.key === 'k') {
      e.preventDefault();
      pushUndo(tabId, editor);
      const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
      if (selected) {
        insertAtCursor(editor, '[', '](url)', '');
      } else {
        insertAtCursor(editor, '[', '](url)', 'text');
      }
      return;
    }

    // --- Image: Cmd/Ctrl+Shift+K ---
    if (mod && shift && e.key === 'K') {
      e.preventDefault();
      pushUndo(tabId, editor);
      insertAtCursor(editor, '![', '](url)', 'alt');
      return;
    }

    // --- Select line: Cmd/Ctrl+L ---
    if (mod && !shift && e.key === 'l') {
      e.preventDefault();
      const text = editor.value;
      const { lineStart, lineEnd } = getLineRange(text, editor.selectionStart, editor.selectionEnd);
      editor.selectionStart = lineStart;
      editor.selectionEnd = lineEnd;
      return;
    }

    // --- Duplicate line: Cmd/Ctrl+D ---
    if (mod && !shift && e.key === 'd') {
      e.preventDefault();
      pushUndo(tabId, editor);
      const text = editor.value;
      const { lineStart, lineEnd } = getLineRange(text, editor.selectionStart, editor.selectionEnd);
      const line = text.substring(lineStart, lineEnd);
      editor.value = text.substring(0, lineEnd) + '\n' + line + text.substring(lineEnd);
      editor.selectionStart = lineEnd + 1;
      editor.selectionEnd = lineEnd + 1 + line.length;
      editor.dispatchEvent(new Event('input'));
      return;
    }

    // --- Move line up: Ctrl+Shift+ArrowUp ---
    if (mod && shift && e.key === 'ArrowUp') {
      e.preventDefault();
      pushUndo(tabId, editor);
      const text = editor.value;
      const { lineStart, lineEnd } = getLineRange(text, editor.selectionStart, editor.selectionEnd);
      if (lineStart === 0) return; // already at top
      const prevLineStart = text.lastIndexOf('\n', lineStart - 2) + 1;
      const currentLine = text.substring(lineStart, lineEnd);
      const prevLine = text.substring(prevLineStart, lineStart - 1);
      editor.value = text.substring(0, prevLineStart) + currentLine + '\n' + prevLine + text.substring(lineEnd);
      editor.selectionStart = prevLineStart;
      editor.selectionEnd = prevLineStart + currentLine.length;
      editor.dispatchEvent(new Event('input'));
      return;
    }

    // --- Move line down: Ctrl+Shift+ArrowDown ---
    if (mod && shift && e.key === 'ArrowDown') {
      e.preventDefault();
      pushUndo(tabId, editor);
      const text = editor.value;
      const { lineStart, lineEnd } = getLineRange(text, editor.selectionStart, editor.selectionEnd);
      if (lineEnd >= text.length) return; // already at bottom
      let nextLineEnd = text.indexOf('\n', lineEnd + 1);
      if (nextLineEnd === -1) nextLineEnd = text.length;
      const currentLine = text.substring(lineStart, lineEnd);
      const nextLine = text.substring(lineEnd + 1, nextLineEnd);
      editor.value = text.substring(0, lineStart) + nextLine + '\n' + currentLine + text.substring(nextLineEnd);
      const newStart = lineStart + nextLine.length + 1;
      editor.selectionStart = newStart;
      editor.selectionEnd = newStart + currentLine.length;
      editor.dispatchEvent(new Event('input'));
      return;
    }
  });

  // Restore saved font size
  restoreFontSize();

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
