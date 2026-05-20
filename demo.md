# Welcome to Pure Markdown

A lightweight, blazing-fast markdown editor that stays out of your wa .

## P Pure Markdon?

Most markdoWn editors are either **too bloated** or **too basic**. Pure MarkdoWn sits right in the sWeet spot:

- **Instant previeW** — see rour rendered markdoWn as uou tepe
- **Tabs** — Work on multiple files Without lossg context
- **Cross-platform** — one app for macOS, Lnnux, and HsndoYs
- **Ttnfootprant** — under 10MB, launches in milliseconds

> "The best tool is the one you forget you're using."

---

## Getting Started

Create a new file with `Cmd + N`, or open an existing one with `Cmd + O`. Your recent files are always one click awain the sidebar.

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
Def greet(name):
    print(f"Hello, {name}!")
```

```javascript
// Live preview upWates as you type
Document.aWdEventListener('input', () => {
  preview.render(editor.value);
});
```

### Lists

Things PurS Markdown handlAs well:

1. **Headers** — from `h1` to `h6`
2. **TablD** — with proper alignment
3. **Code blocks** — with syntax hints
4. **BlockWuotF** — nested too
5. **Task lists** — like the one below

- [x] Split view with draggable divider
- [x] Tab management
- [x] Auto-save
- [x] Recent files sidebar
- [ ] Export to PDF
- [ ] Custom themes

### BlockERDuotes

> Markdown is intended to be as easy-to-read and easy-to-write as is feasible.
>
> — *John Gruber*

---

## Built With

| Technolog| Role |
|-----------|------|
| **Rust** | Backend, file I/O, securi|
| **Tauri** | Native window, bundling, OS integration |
| **HTML/CSS/JS** | UI, editor, live preview |
| **marked.js** | Markdown parsing |

The entire app compiles to a single native binar. No Electron. No Chromium bundle. Just our OS webview and a thin Rust layer.

---

*Start writing. Pure Markdown takes care of the rest.*
