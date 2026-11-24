use std::{fs, io::Write};
use tauri::{ipc, AppHandle, Url};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub async fn save_workspace_export(app: AppHandle, request: ipc::Request<'_>) -> Result<bool, String> {
    let ipc::InvokeBody::Raw(payload) = request.body() else {
        return Err("Некорректные данные для экспорта.".into());
    };
    let header = payload.get(..2).ok_or("Не найдено имя файла.")?;
    let name_size = usize::from(u16::from_be_bytes([header[0], header[1]]));
    let name = payload.get(2..2 + name_size)
        .and_then(|bytes| std::str::from_utf8(bytes).ok())
        .filter(|name| !name.is_empty() && !matches!(*name, "." | "..")
            && !name.chars().any(|c| c.is_control() || matches!(c, '/' | '\\' | ':')))
        .ok_or("Некорректное имя файла.")?;
    let data = &payload[2 + name_size..];
    if data.len() > 150 * 1024 * 1024 {
        return Err("Размер файла превышает 150 МБ.".into());
    }

    let Some(selection) = app.dialog().file().set_file_name(name).blocking_save_file() else {
        return Ok(false);
    };
    let destination = selection.into_path().map_err(|_| "Выберите локальную папку.")?;
    let directory = destination.parent().ok_or("Не найдена папка назначения.")?;
    let temporary = directory.join(format!(".foxspace-export-{}.tmp", super::chrono_stamp()));
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temporary)
        .map_err(|error| format!("Не удалось открыть файл для записи: {error}"))?;
    let result = (|| -> std::io::Result<()> {
        file.write_all(data)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, &destination)
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Не удалось сохранить файл: {error}"));
    }
    Ok(true)
}

#[tauri::command]
pub fn open_external_link(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "Некорректная ссылка.")?;
    if !matches!(parsed.scheme(), "https" | "http" | "mailto") {
        return Err("Эта ссылка не поддерживается.".into());
    }
    app.opener().open_url(parsed.as_str(), None::<&str>)
        .map_err(|error| format!("Не удалось открыть ссылку: {error}"))
}
