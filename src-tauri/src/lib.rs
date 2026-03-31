use serde_json;
use std::fs;
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri_plugin_cli::CliExt;

struct InitialFile(Mutex<Option<String>>);

#[tauri::command]
fn get_initial_file(state: tauri::State<'_, InitialFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[tauri::command]
fn get_recent_files(app: tauri::AppHandle) -> Vec<String> {
    let path = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("recent.json");
    if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    }
}

#[tauri::command]
fn save_recent_files(app: tauri::AppHandle, files: Vec<String>) {
    let dir = app.path().app_data_dir().unwrap_or_default();
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("recent.json");
    if let Ok(json) = serde_json::to_string(&files) {
        let _ = fs::write(path, json);
    }
}

#[tauri::command]
fn get_session(app: tauri::AppHandle) -> String {
    let path = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("session.json");
    fs::read_to_string(&path).unwrap_or_else(|_| "null".to_string())
}

#[tauri::command]
fn save_session(app: tauri::AppHandle, session: String) {
    let dir = app.path().app_data_dir().unwrap_or_default();
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("session.json");
    let _ = fs::write(path, session);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_cli::init())
        .manage(InitialFile(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_recent_files,
            save_recent_files,
            get_session,
            save_session,
            get_initial_file
        ])
        .setup(|app| {
            // --- Build native menu bar ---
            let app_menu = SubmenuBuilder::new(app, "PureMarkdown")
                .item(&PredefinedMenuItem::about(app, Some("About Pure Markdown"), Some(AboutMetadata::default()))?)
                .separator()
                .item(&PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&MenuItemBuilder::new("New File").accelerator("CmdOrCtrl+N").id("new").build(app)?)
                .item(&MenuItemBuilder::new("Open...").accelerator("CmdOrCtrl+O").id("open").build(app)?)
                .separator()
                .item(&MenuItemBuilder::new("Save").accelerator("CmdOrCtrl+S").id("save").build(app)?)
                .separator()
                .item(&MenuItemBuilder::new("Close Tab").accelerator("CmdOrCtrl+W").id("close-tab").build(app)?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&MenuItemBuilder::new("Undo").accelerator("CmdOrCtrl+Z").id("undo").build(app)?)
                .item(&MenuItemBuilder::new("Redo").accelerator("CmdOrCtrl+Y").id("redo").build(app)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .separator()
                .item(&MenuItemBuilder::new("Bold").accelerator("CmdOrCtrl+B").id("bold").build(app)?)
                .item(&MenuItemBuilder::new("Italic").accelerator("CmdOrCtrl+I").id("italic").build(app)?)
                .item(&MenuItemBuilder::new("Inline Code").accelerator("CmdOrCtrl+E").id("inline-code").build(app)?)
                .item(&MenuItemBuilder::new("Code Block").accelerator("CmdOrCtrl+Shift+E").id("code-block").build(app)?)
                .item(&MenuItemBuilder::new("Insert Link").accelerator("CmdOrCtrl+K").id("link").build(app)?)
                .item(&MenuItemBuilder::new("Insert Image").accelerator("CmdOrCtrl+Shift+K").id("image").build(app)?)
                .separator()
                .item(&MenuItemBuilder::new("Select Line").accelerator("CmdOrCtrl+L").id("select-line").build(app)?)
                .item(&MenuItemBuilder::new("Duplicate Line").accelerator("CmdOrCtrl+D").id("duplicate-line").build(app)?)
                .item(&MenuItemBuilder::new("Move Line Up").accelerator("CmdOrCtrl+Shift+Up").id("move-line-up").build(app)?)
                .item(&MenuItemBuilder::new("Move Line Down").accelerator("CmdOrCtrl+Shift+Down").id("move-line-down").build(app)?)
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&MenuItemBuilder::new("Toggle Sidebar").accelerator("CmdOrCtrl+\\").id("toggle-sidebar").build(app)?)
                .separator()
                .item(&MenuItemBuilder::new("Editor Only").accelerator("CmdOrCtrl+1").id("view-editor").build(app)?)
                .item(&MenuItemBuilder::new("Split View").accelerator("CmdOrCtrl+2").id("view-split").build(app)?)
                .item(&MenuItemBuilder::new("Preview Only").accelerator("CmdOrCtrl+3").id("view-preview").build(app)?)
                .separator()
                .item(&MenuItemBuilder::new("Zoom In").accelerator("CmdOrCtrl+=").id("zoom-in").build(app)?)
                .item(&MenuItemBuilder::new("Zoom Out").accelerator("CmdOrCtrl+-").id("zoom-out").build(app)?)
                .item(&MenuItemBuilder::new("Reset Zoom").accelerator("CmdOrCtrl+0").id("zoom-reset").build(app)?)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&MenuItemBuilder::new("Keyboard Shortcuts").id("shortcuts-help").build(app)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            // Forward menu events to the frontend
            app.on_menu_event(move |app_handle, event| {
                let _ = app_handle.emit("menu-event", event.id().0.as_str());
            });

            // Check CLI args for a file path — store it for the frontend to pick up
            if let Ok(matches) = app.cli().matches() {
                if let Some(file_arg) = matches.args.get("file") {
                    if let Some(path_str) = file_arg.value.as_str() {
                        if !path_str.is_empty() {
                            let state = app.state::<InitialFile>();
                            *state.0.lock().unwrap() = Some(path_str.to_string());
                        }
                    }
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri app")
        .run(|app, event| {
            // Handle macOS file-open events (double-click .md in Finder)
            if let tauri::RunEvent::Opened { urls } = event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        let path_str = path.to_string_lossy().to_string();
                        // Store for frontend to pick up (handles cold start race condition)
                        if let Some(state) = app.try_state::<InitialFile>() {
                            let mut initial = state.0.lock().unwrap();
                            if initial.is_none() {
                                *initial = Some(path_str.clone());
                            }
                        }
                        // Also emit event (works when frontend listener is already registered)
                        let _ = app.emit("open-file", path_str);
                    }
                }
            }
        });
}
