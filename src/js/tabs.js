import AppState from './state.js';
import { renderPreview } from './preview.js';
import { closeTab } from './fileops.js';
import { updateCounts } from './editor.js';

const tabsContainer = () => document.getElementById('tabs-container');
const editorEl = () => document.getElementById('editor');

export function renderTabs() {
  const container = tabsContainer();
  container.innerHTML = '';

  for (const tab of AppState.tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === AppState.activeTabId ? ' active' : '') + (tab.isDirty ? ' dirty' : '');
    el.dataset.tabId = tab.id;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = tab.fileName;
    el.appendChild(nameSpan);

    const dot = document.createElement('span');
    dot.className = 'dirty-dot';
    el.appendChild(dot);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(closeBtn);

    el.addEventListener('click', () => switchToTab(tab.id));
    container.appendChild(el);
  }
}

export function switchToTab(tabId) {
  // Save current editor content to the old tab
  if (AppState.activeTabId) {
    const oldTab = AppState.tabs.find(t => t.id === AppState.activeTabId);
    if (oldTab) {
      oldTab.content = editorEl().value;
    }
  }

  AppState.activeTabId = tabId;
  const tab = AppState.tabs.find(t => t.id === tabId);
  if (!tab) return;

  // Load content into editor
  editorEl().value = tab.content;
  renderPreview(tab.content);
  renderTabs();

  // Update window title and counters
  document.title = `${tab.fileName} - Pure Markdown`;
  updateCounts();
}
