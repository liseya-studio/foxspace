use serde_json::Value;

#[cfg(target_os = "macos")]
mod mac {
    use serde_json::Value;
    use std::time::Duration;

    pub const FEED_URL: &str = "https://raw.githubusercontent.com/liseya-studio/foxspace/main/public/feed.json";

    pub fn client() -> Result<reqwest::Client, String> {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|_| "Не удалось создать HTTPS-клиент.".into())
    }

    pub fn vk_entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new("studio.liseya.foxspace.vk", "community")
            .map_err(|_| "Не удалось открыть macOS Keychain.".into())
    }

    pub fn vk_credentials() -> Result<Option<(i64, String)>, String> {
        match vk_entry()?.get_password() {
            Ok(value) => {
                let (id, token) = value.split_once(':').ok_or("Повреждено подключение ВКонтакте.")?;
                Ok(Some((id.parse().map_err(|_| "Некорректный ID сообщества.")?, token.to_owned())))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err("Не удалось прочитать подключение из macOS Keychain.".into()),
        }
    }

    pub async fn vk(
        group_id: i64,
        token: &str,
        method: &str,
        mut params: Vec<(&str, String)>,
    ) -> Result<Value, String> {
        params.extend([
            ("group_id", group_id.to_string()),
            ("v", "5.199".into()),
            ("access_token", token.into()),
        ]);
        let response = client()?.post(format!("https://api.vk.com/method/{method}"))
            .form(&params)
            .send().await.map_err(|_| "ВКонтакте не отвечает. Проверьте подключение к сети.")?
            .error_for_status().map_err(|_| "ВКонтакте вернул ошибку HTTP.")?;
        let mut body: Value = response.json().await.map_err(|_| "ВКонтакте вернул некорректный ответ.")?;
        if let Some(value) = body.get_mut("response") {
            return Ok(value.take());
        }
        let code = body.pointer("/error/error_code").and_then(Value::as_u64).unwrap_or(0);
        Err(match code {
            5 | 15 | 27 => "VK отклонил доступ. Проверьте ключ сообщества и доступ к сообщениям.".into(),
            6 | 29 => "VK временно ограничил частоту запросов. Повторите позже.".into(),
            _ => format!("Запрос ВКонтакте завершился ошибкой (код {code})."),
        })
    }

    pub async fn with_vk(method: &str, params: Vec<(&str, String)>) -> Result<Value, String> {
        let (id, token) = vk_credentials()?.ok_or("Сначала подключите сообщество ВКонтакте.")?;
        vk(id, &token, method, params).await
    }
}

#[tauri::command]
pub async fn fetch_social_feed() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let response = mac::client()?.get(mac::FEED_URL)
            .header("Cache-Control", "no-cache")
            .send().await.map_err(|_| "Не удалось загрузить ленту из GitHub.")?
            .error_for_status().map_err(|_| "GitHub вернул ошибку при загрузке ленты.")?;
        response.json().await.map_err(|_| "GitHub вернул некорректный формат ленты.".into())
    }
    #[cfg(not(target_os = "macos"))]
    Err("Обновление ленты доступно в приложении macOS.".into())
}

#[tauri::command]
pub fn vk_connection() -> Result<Option<i64>, String> {
    #[cfg(target_os = "macos")]
    return Ok(mac::vk_credentials()?.map(|(id, _)| id));
    #[cfg(not(target_os = "macos"))]
    Ok(None)
}

#[tauri::command]
pub async fn vk_connect(group_id: i64, token: String) -> Result<Value, String> {
    let token = token.trim();
    if !(1..=i64::from(i32::MAX)).contains(&group_id) || !(20..=512).contains(&token.len())
        || !token.bytes().all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte)) {
        return Err("Проверьте числовой ID сообщества и ключ доступа.".into());
    }
    #[cfg(target_os = "macos")]
    {
        let dialogs = mac::vk(group_id, token, "messages.getConversations", conversation_params()).await?;
        mac::vk_entry()?.set_password(&format!("{group_id}:{token}"))
            .map_err(|_| "Не удалось сохранить ключ в macOS Keychain.")?;
        Ok(dialogs)
    }
    #[cfg(not(target_os = "macos"))]
    Err("Подключение ВКонтакте доступно в приложении macOS.".into())
}

#[tauri::command]
pub fn vk_disconnect() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return match mac::vk_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Не удалось удалить ключ из macOS Keychain.".into()),
    };
    #[cfg(not(target_os = "macos"))]
    Ok(())
}

#[cfg(target_os = "macos")]
fn conversation_params() -> Vec<(&'static str, String)> {
    vec![("count", "100".into()), ("extended", "1".into())]
}

#[tauri::command]
pub async fn vk_conversations() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    return mac::with_vk("messages.getConversations", conversation_params()).await;
    #[cfg(not(target_os = "macos"))]
    Err("Сообщения ВКонтакте доступны в приложении macOS.".into())
}

#[tauri::command]
pub async fn vk_history(peer_id: i64, offset: u32) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    return mac::with_vk("messages.getHistory", vec![
        ("peer_id", peer_id.to_string()), ("count", "50".into()), ("offset", offset.to_string()),
    ]).await;
    #[cfg(not(target_os = "macos"))]
    Err("Сообщения ВКонтакте доступны в приложении macOS.".into())
}

#[tauri::command]
pub async fn vk_send(peer_id: i64, text: String, random_id: i32) -> Result<Value, String> {
    let text = text.trim();
    if peer_id == 0 || random_id <= 0 || text.is_empty() || text.chars().count() > 4096 {
        return Err("Проверьте получателя и длину сообщения (до 4096 символов).".into());
    }
    #[cfg(target_os = "macos")]
    return mac::with_vk("messages.send", vec![
        ("peer_id", peer_id.to_string()), ("message", text.into()), ("random_id", random_id.to_string()),
    ]).await;
    #[cfg(not(target_os = "macos"))]
    Err("Отправка ВКонтакте доступна в приложении macOS.".into())
}
