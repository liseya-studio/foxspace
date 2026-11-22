use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

fn workspace_file(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| format!("App data directory unavailable: {e}"))?;
    fs::create_dir_all(&root).map_err(|e| format!("Cannot create app data directory: {e}"))?;
    Ok(root.join("workspace.json"))
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

#[tauri::command]
fn create_native_backup(app: AppHandle) -> Result<String, String> {
    let source = workspace_file(&app)?;
    if !source.exists() { return Err("No native workspace snapshot exists yet".into()); }
    let root = source.parent().ok_or("Invalid app data directory")?;
    let backups = root.join("backups");
    fs::create_dir_all(&backups).map_err(|e| format!("Cannot create backup directory: {e}"))?;
    let stamp = chrono_stamp();
    let target = backups.join(format!("workspace-{stamp}.json"));
    fs::copy(&source, &target).map_err(|e| format!("Cannot create native backup: {e}"))?;
    let mut entries: Vec<_> = fs::read_dir(&backups).map_err(|e| e.to_string())?
        .filter_map(Result::ok).filter(|entry| entry.path().extension().and_then(|x| x.to_str()) == Some("json")).collect();
    entries.sort_by_key(|entry| entry.metadata().and_then(|m| m.modified()).ok());
    let excess = entries.len().saturating_sub(10);
    for entry in entries.into_iter().take(excess) { let _ = fs::remove_file(entry.path()); }
    Ok(target.to_string_lossy().into_owned())
}

fn chrono_stamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let seconds = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    format!("{seconds}")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_workspace_snapshot, write_workspace_snapshot, create_native_backup])
        .run(tauri::generate_context!())
        .expect("error while running Fox Space");
}
