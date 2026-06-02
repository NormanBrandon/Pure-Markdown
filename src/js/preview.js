import AppState from './state.js';

const previewEl = () => document.getElementById('preview');

// Register KaTeX extension for math rendering ($...$ and $$...$$)
if (typeof marked !== 'undefined' && typeof markedKatex !== 'undefined') {
  marked.use(markedKatex({ nonStandard: true, throwOnError: false }));
}

// Escape text destined for an HTML text node or double-quoted attribute value.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// DOMPurify config: KaTeX needs MathML; local images use the Tauri asset: scheme.
const PURIFY_CONFIG = {
  USE_PROFILES: { html: true, mathMl: true },
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|asset):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

function resolveImageSrc(href) {
  // Allow only safe, expected schemes. Reject javascript:, vbscript:, etc.
  if (/^(https?:|data:image\/)/i.test(href)) return href;
  if (/^[a-z][a-z0-9+.\-]*:/i.test(href)) return ''; // some other scheme — drop it

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
          return `<pre><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>`;
        }
        const highlighted = hljs.highlightAuto(text).value;
        return `<pre><code class="hljs">${highlighted}</code></pre>`;
      }
      return `<pre><code>${escapeHtml(text)}</code></pre>`;
    };

    // Resolve relative image paths to absolute paths
    renderer.image = function({ href, title, text }) {
      const src = resolveImageSrc(href);
      if (!src) return escapeHtml(text || '');
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text || '')}"${titleAttr}>`;
    };

    const dirty = marked.parse(markdown || '', {
      breaks: true,
      gfm: true,
      renderer
    });
    previewEl().innerHTML =
      typeof DOMPurify !== 'undefined'
        ? DOMPurify.sanitize(dirty, PURIFY_CONFIG)
        : basicMarkdown(markdown || '');
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
