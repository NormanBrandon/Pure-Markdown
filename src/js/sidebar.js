import AppState from './state.js';
import { openFile, removeFromRecent } from './fileops.js';

export function renderRecent() {
  const list = document.getElementById('recent-list');
  list.innerHTML = '';

  for (const filePath of AppState.recentFiles) {
    const fileName = filePath.split('/').pop().split('\\').pop();
    const parts = filePath.split('/');
    const parentDir = parts.length > 1 ? parts[parts.length - 2] : '';

    const li = document.createElement('li');
    li.title = filePath;

    const textWrap = document.createElement('div');
    textWrap.className = 'recent-text';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = fileName;
    textWrap.appendChild(nameSpan);

    if (parentDir) {
      const pathSpan = document.createElement('span');
      pathSpan.className = 'file-path';
      pathSpan.textContent = parentDir;
      textWrap.appendChild(pathSpan);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'recent-remove';
    removeBtn.title = 'Remove from recent';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromRecent(filePath);
    });

    li.appendChild(textWrap);
    li.appendChild(removeBtn);
    li.addEventListener('click', () => openFile(filePath));
    list.appendChild(li);
  }

  if (AppState.recentFiles.length === 0) {
    const li = document.createElement('li');
    li.style.color = 'var(--text-muted)';
    li.style.cursor = 'default';
    li.textContent = 'No recent files';
    list.appendChild(li);
  }
}
