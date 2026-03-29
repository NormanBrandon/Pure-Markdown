use serde_json;
use std::fs;
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;
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
