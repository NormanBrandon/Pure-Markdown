import AppState from './state.js';

const previewEl = () => document.getElementById('preview');

function resolveImageSrc(href) {
  // Already a URL (http, https, data URI) — leave as-is
  if (/^(https?:|data:)/i.test(href)) return href;

  const activeTab = AppState.tabs.find(t => t.id === AppState.activeTabId);
  if (!activeTab || !activeTab.filePath) return href;

  // Get the directory of the current file
  const fileDir = activeTab.filePath.replace(/[/\\][^/\\]*$/, '');

  // Resolve the relative path against the file directory
  let absolutePath;
  if (href.startsWith('/')) {
    absolutePath = href;
  } else {
    absolutePath = fileDir + '/' + href;
  }

  // Convert to Tauri asset protocol URL
  if (window.__TAURI__ && window.__TAURI__.core.convertFileSrc) {
    return window.__TAURI__.core.convertFileSrc(absolutePath);
  }
  return absolutePath;
}

export function renderPreview(markdown) {
  if (typeof marked !== 'undefined' && marked.parse) {
    const renderer = new marked.Renderer();

    // Custom code block renderer with highlight.js
    renderer.code = function({ text, lang }) {
      if (typeof hljs !== 'undefined') {
        if (lang && hljs.getLanguage(lang)) {
          const highlighted = hljs.highlight(text, { language: lang }).value;
          return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
        }
        const highlighted = hljs.highlightAuto(text).value;
        return `<pre><code class="hljs">${highlighted}</code></pre>`;
      }
      return `<pre><code>${text}</code></pre>`;
    };

    // Resolve relative image paths to absolute paths
    renderer.image = function({ href, title, text }) {
      const src = resolveImageSrc(href);
      const titleAttr = title ? ` title="${title}"` : '';
      return `<img src="${src}" alt="${text || ''}"${titleAttr}>`;
    };

    previewEl().innerHTML = marked.parse(markdown || '', {
      breaks: true,
      gfm: true,
      renderer
    });
  } else {
    previewEl().innerHTML = basicMarkdown(markdown || '');
  }
}

function basicMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}
