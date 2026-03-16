# Welcome to Pure Markdown

A lightweight, blazing-fast markdown editor that stays out of your way.

## Why Pure Markdown?

Most markdown editors are either **too bloated** or **too basic**. Pure Markdown sits right in the sweet spot:

- **Instant preview** — see your rendered markdown as you type
- **Tabs** — work on multiple files without losing context
- **Cross-platform** — one app for macOS, Linux, and Windows
- **Tiny footprint** — under 10MB, launches in milliseconds

> "The best tool is the one you forget you're using."

---

## Getting Started

Create a new file with `Cmd + N`, or open an existing one with `Cmd + O`. Your recent files are always one click away in the sidebar.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + N` | New file |
| `Cmd + O` | Open file |
| `Cmd + S` | Save |
| `Cmd + W` | Close tab |

---

## Markdown Cheatsheet

### Text Formatting

Write in **bold**, *italic*, or ~~strikethrough~~. Combine them for ***bold italic*** if you need emphasis.

Inline `code` works great for referencing `variables` or `file_names.md`.

### Code Blocks

```rust
fn main() {
    println!("Built with Tauri + Rust");
    println!("Fast. Secure. Native.");
}
```
## Code Blocks

```python
# Python example
def greet(name):
    print(f"Hello, {name}!")
```

```javascript
// Live preview updates as you type
document.addEventListener('input', () => {
  preview.render(editor.value);
});
```

### Lists

Things Pure Markdown handles well:

1. **Headers** — from `h1` to `h6`
2. **Tables** — with proper alignment
3. **Code blocks** — with syntax hints
4. **Blockquotes** — nested too
5. **Task lists** — like the one below

- [x] Split view with draggable divider
- [x] Tab management
- [x] Auto-save
- [x] Recent files sidebar
- [ ] Export to PDF
- [ ] Custom themes

### Blockquotes

> Markdown is intended to be as easy-to-read and easy-to-write as is feasible.
>
> — *John Gruber*

---

## Built With

| Technology | Role |
|-----------|------|
| **Rust** | Backend, file I/O, security |
| **Tauri** | Native window, bundling, OS integration |
| **HTML/CSS/JS** | UI, editor, live preview |
| **marked.js** | Markdown parsing |

The entire app compiles to a single native binary. No Electron. No Chromium bundle. Just your OS webview and a thin Rust layer.

---

*Start writing. Pure Markdown takes care of the rest.*
