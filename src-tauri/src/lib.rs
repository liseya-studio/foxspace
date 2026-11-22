use std::{collections::BTreeMap, fs, path::{Path, PathBuf}};
use sha2::{Digest, Sha256};
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

fn sha256_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("Cannot read backup file for checksum: {e}"))?;
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

fn collect_backup_hashes(root: &Path, current: &Path, hashes: &mut BTreeMap<String, String>) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            collect_backup_hashes(root, &path, hashes)?;
        } else if entry.file_name().to_string_lossy() != "manifest.json" {
            let relative = path.strip_prefix(root).map_err(|e| e.to_string())?.to_string_lossy().to_string();
            hashes.insert(relative, sha256_file(&path)?);
        }
    }
    Ok(())
}

fn verify_native_backup(backup_dir: &Path) -> Result<(), String> {
    let manifest_path = backup_dir.join("manifest.json");
    if !manifest_path.exists() { return Err("Нативная копия не содержит манифест целостности".into()); }
    let manifest: serde_json::Value = serde_json::from_slice(&fs::read(manifest_path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Манифест резервной копии повреждён: {e}"))?;
    if manifest.get("algorithm").and_then(|v| v.as_str()) != Some("SHA-256") { return Err("Неподдерживаемый алгоритм целостности резервной копии".into()); }
    let expected = manifest.get("files").and_then(|v| v.as_object()).ok_or("В манифесте отсутствует список файлов")?;
    let mut actual = BTreeMap::new();
    collect_backup_hashes(backup_dir, backup_dir, &mut actual)?;
    if expected.len() != actual.len() { return Err("Состав файлов резервной копии не совпадает с манифестом".into()); }
    for (path, digest) in expected {
        let expected_digest = digest.as_str().ok_or("Некорректная контрольная сумма в манифесте")?;
        if actual.get(path).map(String::as_str) != Some(expected_digest) { return Err(format!("Контрольная сумма файла «{path}» не совпадает")); }
    }
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
        .filter_map(Result::ok).filter(|entry| entry.path().is_dir() && entry.path().join("workspace.json").exists() && entry.path().join("manifest.json").exists()).collect();
    entries.sort_by_key(|entry| entry.metadata().and_then(|m| m.modified()).ok());
    let latest = entries.pop().ok_or("Нативных резервных копий пока нет")?.path();
    verify_native_backup(&latest)?;
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
    let mut hashes = BTreeMap::new();
    collect_backup_hashes(&backup_dir, &backup_dir, &mut hashes)?;
    let manifest = serde_json::json!({"algorithm":"SHA-256","files":hashes});
    let manifest_bytes = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(backup_dir.join("manifest.json"), manifest_bytes).map_err(|e| format!("Cannot write backup integrity manifest: {e}"))?;
    let mut entries: Vec<_> = fs::read_dir(&backups).map_err(|e| e.to_string())?
        .filter_map(Result::ok).filter(|entry| entry.path().is_dir()).collect();
    entries.sort_by_key(|entry| entry.metadata().and_then(|m| m.modified()).ok());
    let excess = entries.len().saturating_sub(10);
    for entry in entries.into_iter().take(excess) { let _ = fs::remove_dir_all(entry.path()); }
    Ok(backup_dir.to_string_lossy().into_owned())
}

const OPENAI_KEY_SERVICE: &str = "studio.liseya.foxspace";
const OPENAI_KEY_ACCOUNT: &str = "openai-api-key";

#[tauri::command]
fn openai_key_status() -> Result<bool, String> {
    #[cfg(target_os = "macos")] {
        let entry = keyring::Entry::new(OPENAI_KEY_SERVICE, OPENAI_KEY_ACCOUNT)
            .map_err(|e| format!("Не удалось открыть macOS Keychain: {e}"))?;
        return Ok(entry.get_password().is_ok());
    }
    #[cfg(not(target_os = "macos"))] {
        Ok(false)
    }
}

#[tauri::command]
fn save_openai_api_key(key: String) -> Result<(), String> {
    let key = key.trim();
    if !key.starts_with("sk-") || key.len() < 20 || key.len() > 512 {
        return Err("Проверьте формат API-ключа OpenAI.".into());
    }
    #[cfg(target_os = "macos")] {
        let entry = keyring::Entry::new(OPENAI_KEY_SERVICE, OPENAI_KEY_ACCOUNT)
            .map_err(|e| format!("Не удалось открыть macOS Keychain: {e}"))?;
        return entry.set_password(key).map_err(|e| format!("Не удалось сохранить ключ в macOS Keychain: {e}"));
    }
    #[cfg(not(target_os = "macos"))] {
        let _ = key;
        Err("Хранение ключа OpenAI доступно в нативной macOS-версии Fox Space.".into())
    }
}

#[tauri::command]
fn delete_openai_api_key() -> Result<(), String> {
    #[cfg(target_os = "macos")] {
        let entry = keyring::Entry::new(OPENAI_KEY_SERVICE, OPENAI_KEY_ACCOUNT)
            .map_err(|e| format!("Не удалось открыть macOS Keychain: {e}"))?;
        return match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Не удалось удалить ключ из macOS Keychain: {e}")),
        };
    }
    #[cfg(not(target_os = "macos"))] {
        Err("Управление ключом OpenAI доступно в нативной macOS-версии Fox Space.".into())
    }
}

#[tauri::command]
async fn openai_responses_create(model: String, prompt: String, instructions: Option<String>) -> Result<String, String> {
    let model = model.trim();
    if !["gpt-6.2-sol", "gpt-6.2-astra"].contains(&model) {
        return Err("Выбрана неподдерживаемая модель.".into());
    }
    let prompt = prompt.trim();
    if prompt.is_empty() || prompt.len() > 50_000 {
        return Err("Запрос должен содержать от 1 до 50 000 символов.".into());
    }
    let instructions = instructions.unwrap_or_else(|| "Ты — AI-помощник Fox Space. Отвечай на русском языке, кратко и структурированно. Не утверждай, что изменил данные рабочего пространства: этот режим только отвечает на вопросы.".into());
    if instructions.len() > 8_000 {
        return Err("Инструкции превышают лимит 8 000 символов.".into());
    }
    #[cfg(target_os = "macos")] {
        let entry = keyring::Entry::new(OPENAI_KEY_SERVICE, OPENAI_KEY_ACCOUNT)
            .map_err(|e| format!("Не удалось открыть macOS Keychain: {e}"))?;
        let key = entry.get_password().map_err(|_| "Сначала сохраните API-ключ OpenAI в настройках AI-помощника.".to_string())?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(90))
            .build()
            .map_err(|e| format!("Не удалось создать HTTPS-клиент: {e}"))?;
        let payload = serde_json::json!({
            "model": model,
            "instructions": instructions,
            "input": prompt,
            "store": false,
            "max_output_tokens": 1800
        });
        let response = client.post("https://api.openai.com/v1/responses")
            .bearer_auth(key)
            .json(&payload)
            .send().await
            .map_err(|e| format!("Ошибка соединения с OpenAI: {e}"))?;
        let status = response.status();
        let body: serde_json::Value = response.json().await
            .map_err(|e| format!("OpenAI вернул некорректный ответ: {e}"))?;
        if !status.is_success() {
            let detail = body.pointer("/error/message").and_then(|v| v.as_str()).unwrap_or("Неизвестная ошибка API");
            return Err(format!("OpenAI API ({}): {}", status.as_u16(), detail));
        }
        let mut output = Vec::new();
        if let Some(items) = body.get("output").and_then(|v| v.as_array()) {
            for item in items {
                if item.get("type").and_then(|v| v.as_str()) != Some("message") { continue; }
                if let Some(parts) = item.get("content").and_then(|v| v.as_array()) {
                    for part in parts {
                        if part.get("type").and_then(|v| v.as_str()) == Some("output_text") {
                            if let Some(text) = part.get("text").and_then(|v| v.as_str()) { output.push(text); }
                        }
                    }
                }
            }
        }
        if output.is_empty() {
            return Err("Модель не вернула текстовый ответ. Попробуйте изменить запрос.".into());
        }
        return Ok(output.join("\n\n"));
    }
    #[cfg(not(target_os = "macos"))] {
        Err("AI-помощник с защищённым хранилищем ключа доступен в нативной macOS-версии Fox Space.".into())
    }
}


#[tauri::command]
async fn openai_responses_with_tools(model: String, input: String, instructions: Option<String>, tools: Option<serde_json::Value>) -> Result<String, String> {
    let model = model.trim();
    if !["gpt-6.2-sol", "gpt-6.2-astra"].contains(&model) {
        return Err("Выбрана неподдерживаемая модель.".into());
    }
    if input.trim().is_empty() || input.len() > 120_000 {
        return Err("Контекст запроса должен содержать от 1 до 120 000 символов.".into());
    }
    let input_value: serde_json::Value = serde_json::from_str(&input)
        .unwrap_or_else(|_| serde_json::Value::String(input));
    if let Some(ref tool_list) = tools {
        if !tool_list.is_array() || tool_list.as_array().map(|v| v.len() > 12).unwrap_or(true) {
            return Err("Некорректный набор инструментов.".into());
        }
    }
    let instructions = instructions.unwrap_or_else(|| "Ты — AI-агент Fox Space. Используй инструменты только для действий, прямо запрошенных пользователем. Перед изменением данных сообщай, что операция может потребовать подтверждения. Никогда не утверждай, что изменение выполнено, пока инструмент не вернул успешный результат. Отвечай на русском языке.".into());
    if instructions.len() > 12_000 {
        return Err("Инструкции превышают лимит 12 000 символов.".into());
    }
    #[cfg(target_os = "macos")] {
        let entry = keyring::Entry::new(OPENAI_KEY_SERVICE, OPENAI_KEY_ACCOUNT)
            .map_err(|e| format!("Не удалось открыть macOS Keychain: {e}"))?;
        let key = entry.get_password().map_err(|_| "Сначала сохраните API-ключ OpenAI в настройках AI-помощника.".to_string())?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(90))
            .build()
            .map_err(|e| format!("Не удалось создать HTTPS-клиент: {e}"))?;
        let mut payload = serde_json::json!({
            "model": model,
            "instructions": instructions,
            "input": input_value,
            "store": false,
            "max_output_tokens": 2400
        });
        if let Some(tool_list) = tools {
            payload["tools"] = tool_list;
            payload["tool_choice"] = "auto".into();
        }
        let response = client.post("https://api.openai.com/v1/responses")
            .bearer_auth(key)
            .json(&payload)
            .send().await
            .map_err(|e| format!("Ошибка соединения с OpenAI: {e}"))?;
        let status = response.status();
        let body: serde_json::Value = response.json().await
            .map_err(|e| format!("OpenAI вернул некорректный ответ: {e}"))?;
        if !status.is_success() {
            let detail = body.pointer("/error/message").and_then(|v| v.as_str()).unwrap_or("Неизвестная ошибка API");
            return Err(format!("OpenAI API ({}): {}", status.as_u16(), detail));
        }
        return Ok(body.to_string());
    }
    #[cfg(not(target_os = "macos"))] {
        Err("Вызов AI-инструментов доступен в нативной macOS-версии Fox Space.".into())
    }
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
        .invoke_handler(tauri::generate_handler![read_workspace_snapshot, write_workspace_snapshot, write_file_blob, read_file_blob, delete_file_blob, create_native_backup, restore_latest_native_backup, openai_key_status, save_openai_api_key, delete_openai_api_key, openai_responses_create, openai_responses_with_tools])
        .run(tauri::generate_context!())
        .expect("error while running Fox Space");
}
