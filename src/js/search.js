// Search & Replace module

let matches = [];       // array of start positions
let currentIndex = -1;
let queryLen = 0;
let panelOpen = false;
let replaceMode = false;

// Called from editor.js to push undo before replacing
let _pushUndo = null;
export function registerPushUndo(fn) {
  _pushUndo = fn;
}

// ── Open / close ─────────────────────────────────────────────────────────────

export function openSearch() {
  _show(false);
}

export function openReplace() {
  _show(true);
}

function _show(withReplace) {
  const panel = document.getElementById('search-panel');
  const replaceRow = document.getElementById('search-replace-row');
  replaceMode = withReplace;
  panelOpen = true;

  panel.classList.remove('hidden');
  replaceRow.classList.toggle('hidden', !withReplace);

  const input = document.getElementById('search-input');
  // Pre-fill with current selection if any
  const editor = document.getElementById('editor');
  const sel = editor.value.substring(editor.selectionStart, editor.selectionEnd);
  if (sel && !sel.includes('\n')) {
    input.value = sel;
  }
  input.focus();
  input.select();
  _runSearch();
}

export function closeSearch() {
  const panel = document.getElementById('search-panel');
  panel.classList.add('hidden');
  panelOpen = false;

  document.getElementById('editor-highlight-overlay').innerHTML = '';

  const editor = document.getElementById('editor');
  editor.focus();
  if (matches.length > 0 && currentIndex >= 0) {
    editor.setSelectionRange(matches[currentIndex], matches[currentIndex] + queryLen);
  }

  matches = [];
  currentIndex = -1;
  _updateCount();
}

export function isSearchOpen() {
  return panelOpen;
}

// ── Highlight overlay ─────────────────────────────────────────────────────────

function _escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _syncOverlayMetrics() {
  const editor  = document.getElementById('editor');
  const overlay = document.getElementById('editor-highlight-overlay');
  const s = getComputedStyle(editor);
  overlay.style.fontFamily    = s.fontFamily;
  overlay.style.fontSize      = s.fontSize;
  overlay.style.fontWeight    = s.fontWeight;
  overlay.style.fontStyle     = s.fontStyle;
  overlay.style.lineHeight    = s.lineHeight;
  overlay.style.letterSpacing = s.letterSpacing;
  overlay.style.wordSpacing   = s.wordSpacing;
  overlay.style.paddingTop    = s.paddingTop;
  overlay.style.paddingBottom = s.paddingBottom;
  overlay.style.paddingLeft   = s.paddingLeft;
  // Widen right padding by scrollbar width so content area matches exactly
  const scrollbarW = editor.offsetWidth - editor.clientWidth;
  overlay.style.paddingRight  = (parseFloat(s.paddingRight) + scrollbarW) + 'px';
  overlay.style.tabSize       = s.tabSize;
}

function _updateOverlay() {
  const overlay = document.getElementById('editor-highlight-overlay');
  const editor  = document.getElementById('editor');
  if (!panelOpen || matches.length === 0 || !queryLen) {
    overlay.innerHTML = '';
    return;
  }
  _syncOverlayMetrics();
  const text = editor.value;
  const parts = [];
  let last = 0;
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i];
    const end   = start + queryLen;
    if (start > last) parts.push(_escapeHtml(text.substring(last, start)));
    const cls = i === currentIndex ? ' class="current-match"' : '';
    parts.push(`<mark${cls}>${_escapeHtml(text.substring(start, end))}</mark>`);
    last = end;
  }
  if (last < text.length) parts.push(_escapeHtml(text.substring(last)));
  overlay.innerHTML = parts.join('');
  overlay.scrollTop = editor.scrollTop;
}

// ── Core search ───────────────────────────────────────────────────────────────

function _runSearch() {
  const query = document.getElementById('search-input').value;
  const editor = document.getElementById('editor');
  const text = editor.value;

  matches = [];
  currentIndex = -1;
  queryLen = query.length;

  if (!query) {
    _updateCount();
    return;
  }

  const lq = query.toLowerCase();
  const lt = text.toLowerCase();
  let pos = 0;
  while (pos < lt.length) {
    const idx = lt.indexOf(lq, pos);
    if (idx === -1) break;
    matches.push(idx);
    pos = idx + 1;
  }

  if (matches.length > 0) {
    // Start at the match closest to cursor
    const cursor = editor.selectionStart;
    currentIndex = matches.findIndex(m => m >= cursor);
    if (currentIndex === -1) currentIndex = 0;
    _highlightCurrent(editor);
  }
  _updateCount();
  _updateOverlay();
}

function _highlightCurrent(editor) {
  if (currentIndex < 0 || currentIndex >= matches.length) return;
  _scrollToPos(editor, matches[currentIndex]);
}

function _scrollToPos(editor, pos) {
  const textBefore = editor.value.substring(0, pos);
  const linesBefore = textBefore.split('\n').length - 1;
  const lineHeightPx = parseFloat(getComputedStyle(editor).lineHeight) || 24;
  const target = linesBefore * lineHeightPx - editor.clientHeight / 2;
  editor.scrollTop = Math.max(0, target);
}

function _updateCount() {
  const el = document.getElementById('search-count');
  const q = document.getElementById('search-input').value;
  if (!q) {
    el.textContent = '';
    el.classList.remove('search-no-results');
  } else if (matches.length === 0) {
    el.textContent = 'No results';
    el.classList.add('search-no-results');
  } else {
    el.textContent = `${currentIndex + 1} / ${matches.length}`;
    el.classList.remove('search-no-results');
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

export function searchNext() {
  if (matches.length === 0) return;
  currentIndex = (currentIndex + 1) % matches.length;
  _highlightCurrent(document.getElementById('editor'));
  _updateCount();
  _updateOverlay();
}

export function searchPrev() {
  if (matches.length === 0) return;
  currentIndex = (currentIndex - 1 + matches.length) % matches.length;
  _highlightCurrent(document.getElementById('editor'));
  _updateCount();
  _updateOverlay();
}

// ── Replace ───────────────────────────────────────────────────────────────────

function _replaceCurrent() {
  if (matches.length === 0 || currentIndex < 0) return;
  const editor = document.getElementById('editor');
  const query = document.getElementById('search-input').value;
  const replacement = document.getElementById('replace-input').value;
  if (!query) return;

  if (_pushUndo) _pushUndo();
  const start = matches[currentIndex];
  editor.value =
    editor.value.substring(0, start) +
    replacement +
    editor.value.substring(start + query.length);
  editor.dispatchEvent(new Event('input'));
  _runSearch();
}

function _replaceAll() {
  const editor = document.getElementById('editor');
  const query = document.getElementById('search-input').value;
  const replacement = document.getElementById('replace-input').value;
  if (!query || matches.length === 0) return;

  if (_pushUndo) _pushUndo();
  const lq = query.toLowerCase();
  const lt = editor.value.toLowerCase();
  const positions = [];
  let pos = 0;
  while (pos < lt.length) {
    const idx = lt.indexOf(lq, pos);
    if (idx === -1) break;
    positions.push(idx);
    pos = idx + 1;
  }
  // Replace right-to-left so positions stay valid
  let text = editor.value;
  for (let i = positions.length - 1; i >= 0; i--) {
    const p = positions[i];
    text = text.substring(0, p) + replacement + text.substring(p + query.length);
  }
  editor.value = text;
  editor.dispatchEvent(new Event('input'));
  _runSearch();
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initSearch() {
  const searchInput  = document.getElementById('search-input');
  const replaceInput = document.getElementById('replace-input');

  searchInput.addEventListener('input', _runSearch);

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')   { e.preventDefault(); closeSearch(); return; }
    if (e.key === 'Enter')    { e.preventDefault(); e.shiftKey ? searchPrev() : searchNext(); }
  });

  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')   { e.preventDefault(); closeSearch(); return; }
    if (e.key === 'Enter')    { e.preventDefault(); _replaceCurrent(); }
  });

  document.getElementById('search-prev').addEventListener('click', searchPrev);
  document.getElementById('search-next').addEventListener('click', searchNext);
  document.getElementById('search-close').addEventListener('click', closeSearch);
  document.getElementById('btn-replace-one').addEventListener('click', _replaceCurrent);
  document.getElementById('btn-replace-all').addEventListener('click', _replaceAll);

  // Re-run search when editor content changes (positions may shift)
  document.getElementById('editor').addEventListener('input', () => {
    if (panelOpen) _runSearch();
  });

  // Keep overlay in sync when editor scrolls
  document.getElementById('editor').addEventListener('scroll', () => {
    if (panelOpen) {
      document.getElementById('editor-highlight-overlay').scrollTop =
        document.getElementById('editor').scrollTop;
    }
  }, { passive: true });
}
