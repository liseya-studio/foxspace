use std::{fs, path::{Path, PathBuf}};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::{AppHandle, Manager};

fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| format!("App data directory unavailable: {e}"))?;
    fs::create_dir_all(&root).map_err(|e| format!("Cannot create app data directory: {e}"))?;
    Ok(root)
}

fn workspace_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root(app)?.join("workspace.json"))
}

#[tauri::command]
fn read_workspace_snapshot(app: AppHandle) -> Result<Option<String>, String> {
    let path = workspace_file(&app)?;
    if !path.exists() { return Ok(None); }
    let content = fs::read_to_string(path).map_err(|e| format!("Cannot read workspace snapshot: {e}"))?;
    serde_json::from_str::<serde_json::Value>(&content).map_err(|e| format!("Workspace snapshot is invalid JSON: {e}"))?;
    Ok(Some(content))
}

#[tauri::command]
fn write_workspace_snapshot(app: AppHandle, content: String) -> Result<(), String> {
    if content.len() > 200 * 1024 * 1024 { return Err("Workspace snapshot exceeds the 200 MB safety limit".into()); }
    serde_json::from_str::<serde_json::Value>(&content).map_err(|e| format!("Workspace snapshot is invalid JSON: {e}"))?;
    let path = workspace_file(&app)?;
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, content).map_err(|e| format!("Cannot write temporary workspace snapshot: {e}"))?;
    fs::rename(&temp, &path).map_err(|e| format!("Cannot atomically replace workspace snapshot: {e}"))?;
    Ok(())
}


fn native_file_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("Invalid file identifier".into());
    }
    let root = app_data_root(app)?.join("files");
    fs::create_dir_all(&root).map_err(|e| format!("Cannot create native file directory: {e}"))?;
    Ok(root.join(format!("{id}.bin")))
}

#[tauri::command]
fn write_file_blob(app: AppHandle, id: String, data_base64: String) -> Result<(), String> {
    if data_base64.len() > 90 * 1024 * 1024 { return Err("Encoded file exceeds the 60 MB safety limit".into()); }
    let bytes = STANDARD.decode(data_base64).map_err(|e| format!("Invalid file encoding: {e}"))?;
    if bytes.len() > 60 * 1024 * 1024 { return Err("File exceeds the 60 MB safety limit".into()); }
    let path = native_file_path(&app, &id)?;
    let temp = path.with_extension("bin.tmp");
    fs::write(&temp, bytes).map_err(|e| format!("Cannot write native file: {e}"))?;
    fs::rename(&temp, &path).map_err(|e| format!("Cannot atomically replace native file: {e}"))?;
    Ok(())
}

#[tauri::command]
fn read_file_blob(app: AppHandle, id: String) -> Result<Option<String>, String> {
    let path = native_file_path(&app, &id)?;
    if !path.exists() { return Ok(None); }
    let bytes = fs::read(path).map_err(|e| format!("Cannot read native file: {e}"))?;
    Ok(Some(STANDARD.encode(bytes)))
}

#[tauri::command]
fn delete_file_blob(app: AppHandle, id: String) -> Result<(), String> {
    let path = native_file_path(&app, &id)?;
    if path.exists() { fs::remove_file(path).map_err(|e| format!("Cannot delete native file: {e}"))?; }
    Ok(())
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() { return Ok(()); }
    fs::create_dir_all(destination).map_err(|e| format!("Cannot create backup folder: {e}"))?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let target = destination.join(entry.file_name());
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            copy_directory(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target).map_err(|e| format!("Cannot copy user file into backup: {e}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn restore_latest_native_backup(app: AppHandle) -> Result<String, String> {
    let root = app_data_root(&app)?;
    let backups = root.join("backups");
    if !backups.exists() { return Err("Нативных резервных копий пока нет".into()); }
    let mut entries: Vec<_> = fs::read_dir(&backups).map_err(|e| e.to_string())?
        .filter_map(Result::ok).filter(|entry| entry.path().is_dir() && entry.path().join("workspace.json").exists()).collect();
    entries.sort_by_key(|entry| entry.metadata().and_then(|m| m.modified()).ok());
    let latest = entries.pop().ok_or("Нативных резервных копий пока нет")?.path();
    let snapshot = fs::read_to_string(latest.join("workspace.json")).map_err(|e| format!("Cannot read native backup: {e}"))?;
    serde_json::from_str::<serde_json::Value>(&snapshot).map_err(|e| format!("Native backup is invalid JSON: {e}"))?;

    let files_dir = root.join("files");
    let staged = root.join("files.restore-staging");
    let previous = root.join("files.restore-previous");
    if staged.exists() { fs::remove_dir_all(&staged).map_err(|e| e.to_string())?; }
    if previous.exists() { fs::remove_dir_all(&previous).map_err(|e| e.to_string())?; }
    fs::create_dir_all(&staged).map_err(|e| e.to_string())?;
    copy_directory(&latest.join("files"), &staged)?;
    if files_dir.exists() { fs::rename(&files_dir, &previous).map_err(|e| format!("Cannot stage current files: {e}"))?; }
    if let Err(error) = fs::rename(&staged, &files_dir) {
        if previous.exists() { let _ = fs::rename(&previous, &files_dir); }
        return Err(format!("Cannot restore native files: {error}"));
    }
    if let Err(error) = write_workspace_snapshot(app.clone(), snapshot) {
        let _ = fs::remove_dir_all(&files_dir);
        if previous.exists() { let _ = fs::rename(&previous, &files_dir); }
        return Err(format!("Cannot restore workspace snapshot: {error}"));
    }
    if previous.exists() { let _ = fs::remove_dir_all(previous); }
    Ok(latest.to_string_lossy().into_owned())
}

#[tauri::command]
fn create_native_backup(app: AppHandle) -> Result<String, String> {
    let source = workspace_file(&app)?;
    if !source.exists() { return Err("No native workspace snapshot exists yet".into()); }
    let root = app_data_root(&app)?;
    let backups = root.join("backups");
    fs::create_dir_all(&backups).map_err(|e| format!("Cannot create backup directory: {e}"))?;
    let backup_dir = backups.join(chrono_stamp());
    fs::create_dir_all(&backup_dir).map_err(|e| format!("Cannot create backup version: {e}"))?;
    fs::copy(&source, backup_dir.join("workspace.json")).map_err(|e| format!("Cannot create native backup: {e}"))?;
    copy_directory(&root.join("files"), &backup_dir.join("files"))?;
    let mut entries: Vec<_> = fs::read_dir(&backups).map_err(|e| e.to_string())?
        .filter_map(Result::ok).filter(|entry| entry.path().is_dir()).collect();
    entries.sort_by_key(|entry| entry.metadata().and_then(|m| m.modified()).ok());
    let excess = entries.len().saturating_sub(10);
    for entry in entries.into_iter().take(excess) { let _ = fs::remove_dir_all(entry.path()); }
    Ok(backup_dir.to_string_lossy().into_owned())
}
fn chrono_stamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}-{:09}", now.as_secs(), now.subsec_nanos())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![read_workspace_snapshot, write_workspace_snapshot, write_file_blob, read_file_blob, delete_file_blob, create_native_backup, restore_latest_native_backup])
        .run(tauri::generate_context!())
        .expect("error while running Fox Space");
}
