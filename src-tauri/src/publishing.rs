use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform { Telegram, Vk }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Destination {
    id: String,
    title: String,
    url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishError {
    message: String,
    uncertain: bool,
}

impl PublishError {
    fn rejected(message: impl Into<String>) -> Self {
        Self { message: message.into(), uncertain: false }
    }

    fn uncertain() -> Self {
        Self { message: "Площадка не подтвердила результат. Проверьте стену или канал перед повторной отправкой.".into(), uncertain: true }
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use super::{Destination, Platform, PublishError};
    use serde_json::{json, Value};
    use std::time::Duration;

    fn credentials(platform: Platform, id: &str) -> Result<keyring::Entry, PublishError> {
        let service = match platform {
            Platform::Telegram => "studio.liseya.foxspace.publish.telegram",
            Platform::Vk => "studio.liseya.foxspace.publish.vk",
        };
        keyring::Entry::new(service, id)
            .map_err(|_| PublishError::rejected("Не удалось открыть macOS Keychain."))
    }

    pub fn save(platform: Platform, id: &str, token: &str) -> Result<(), PublishError> {
        credentials(platform,id)?.set_password(token)
            .map_err(|_| PublishError::rejected("Не удалось сохранить токен в Keychain."))
    }

    pub fn token(platform: Platform, id: &str) -> Result<String, PublishError> {
        credentials(platform,id)?.get_password()
            .map_err(|_| PublishError::rejected("Переподключите площадку в настройках публикации."))
    }

    pub fn forget(platform: Platform, id: &str) -> Result<(), PublishError> {
        match credentials(platform,id)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(PublishError::rejected("Не удалось удалить токен из Keychain.")),
        }
    }

    fn client() -> Result<reqwest::Client, PublishError> {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .build().map_err(|_| PublishError::rejected("Не удалось открыть HTTPS-соединение."))
    }

    pub async fn telegram(token: &str, method: &str, params: Value) -> Result<Value, PublishError> {
        let response = client()?.post(format!("https://api.telegram.org/bot{token}/{method}"))
            .json(&params).send().await.map_err(|_| PublishError::uncertain())?;
        let body: Value = response.json().await.map_err(|_| PublishError::uncertain())?;
        if body["ok"] == true {
            return body.get("result").cloned().ok_or_else(PublishError::uncertain);
        }
        let code = body["error_code"].as_u64().ok_or_else(PublishError::uncertain)?;
        if code >= 500 { return Err(PublishError::uncertain()); }
        Err(PublishError::rejected(match code {
            401 => "Telegram отклонил токен бота.".into(),
            400 | 403 => "Telegram отклонил запрос. Проверьте канал, права бота и длину текста.".into(),
            _ => format!("Telegram отклонил запрос (код {code})."),
        }))
    }

    pub async fn vk(token: &str, method: &str, mut params: Vec<(&str, String)>) -> Result<Value, PublishError> {
        params.extend([("access_token", token.into()), ("v", "5.199".into())]);
        let response = client()?.post(format!("https://api.vk.com/method/{method}"))
            .form(&params).send().await.map_err(|_| PublishError::uncertain())?;
        let body: Value = response.json().await.map_err(|_| PublishError::uncertain())?;
        if let Some(result) = body.get("response") { return Ok(result.clone()); }
        let code = body.pointer("/error/error_code").and_then(Value::as_u64).ok_or_else(PublishError::uncertain)?;
        if code == 1 || code == 10 { return Err(PublishError::uncertain()); }
        Err(PublishError::rejected(match code {
            5 | 7 | 15 | 27 | 214 => "VK отклонил доступ. Проверьте пользовательский токен, разрешение wall и роль в сообществе.".into(),
            _ => format!("ВКонтакте отклонил запрос (код {code})."),
        }))
    }

    pub fn handle(value: &str) -> bool {
        !value.is_empty() && value.len() <= 64 && value.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
    }

    pub async fn check_telegram(channel: &str, token: &str) -> Result<Destination, PublishError> {
        let chat_id = if let Ok(id) = channel.parse::<i64>() {
            if id >= 0 { return Err(PublishError::rejected("Укажите @имя или отрицательный ID канала.")); }
            json!(id)
        } else {
            let name = channel.trim_start_matches('@');
            if !handle(name) { return Err(PublishError::rejected("Укажите @имя или числовой ID канала.")); }
            json!(format!("@{name}"))
        };
        let bot = telegram(token,"getMe",json!({})).await?;
        let bot_id = bot["id"].as_i64().ok_or_else(PublishError::uncertain)?;
        let chat = telegram(token,"getChat",json!({"chat_id":chat_id})).await?;
        if chat["type"] != "channel" { return Err(PublishError::rejected("Этот адрес относится к чату, а нужен Telegram-канал.")); }
        let id = chat["id"].as_i64().filter(|id| *id < 0).ok_or_else(PublishError::uncertain)?;
        let member = telegram(token,"getChatMember",json!({"chat_id":id,"user_id":bot_id})).await?;
        if member["status"] != "administrator" || member["can_post_messages"] != true {
            return Err(PublishError::rejected("Добавьте бота в администраторы канала и разрешите ему публикацию сообщений."));
        }
        let url = chat["username"].as_str().filter(|name| handle(name)).map(|name| format!("https://t.me/{name}")).unwrap_or_default();
        Ok(Destination {id:id.to_string(), title:chat["title"].as_str().unwrap_or(channel).into(), url})
    }

    pub async fn check_vk(group: &str, token: &str) -> Result<Destination, PublishError> {
        if !handle(group) { return Err(PublishError::rejected("Укажите короткое имя или числовой ID сообщества.")); }
        let permissions = vk(token,"account.getAppPermissions",vec![]).await?;
        if permissions.as_u64().unwrap_or(0) & 8192 == 0 {
            return Err(PublishError::rejected("Пользовательскому токену VK требуется разрешение wall."));
        }
        let result = vk(token,"groups.getById",vec![("group_id",group.into())]).await?;
        let groups = result["groups"].as_array().or_else(|| result.as_array());
        let group = groups.and_then(|items| items.first()).ok_or_else(|| PublishError::rejected("Сообщество VK не найдено."))?;
        let admin_level = group["admin_level"].as_u64();
        if admin_level.map_or(group["is_admin"] != 1 && group["is_admin"] != true, |level| level < 2) {
            return Err(PublishError::rejected("Для публикаций от имени VK-сообщества нужен доступ редактора или администратора."));
        }
        let id = group["id"].as_i64().filter(|id| *id > 0).ok_or_else(PublishError::uncertain)?;
        Ok(Destination {id:id.to_string(), title:group["name"].as_str().unwrap_or("Сообщество VK").into(), url:format!("https://vk.com/club{id}")})
    }
}

fn check_id(platform: Platform, id: &str) -> Result<i64, PublishError> {
    id.parse::<i64>().ok().filter(|id| match platform {
        Platform::Telegram => *id < 0,
        Platform::Vk => *id > 0,
    }).ok_or_else(|| PublishError::rejected("Неверный ID площадки."))
}

#[tauri::command]
pub async fn publishing_connect(platform: Platform, address: String, token: String) -> Result<Destination, PublishError> {
    let token = token.trim();
    let valid = match platform {
        Platform::Telegram => token.split_once(':').is_some_and(|(id,rest)| id.parse::<u64>().is_ok()
            && !rest.is_empty() && rest.bytes().all(|byte| byte.is_ascii_alphanumeric() || b"_-".contains(&byte))),
        Platform::Vk => token.bytes().all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte)),
    };
    if !valid || !(20..=512).contains(&token.len()) { return Err(PublishError::rejected("Проверьте формат токена.")); }
    #[cfg(target_os = "macos")]
    {
        let entry = match platform {
            Platform::Telegram => mac::check_telegram(address.trim(),token).await?,
            Platform::Vk => mac::check_vk(address.trim(),token).await?,
        };
        mac::save(platform,&entry.id,token)?;
        Ok(entry)
    }
    #[cfg(not(target_os = "macos"))]
    Err(PublishError::rejected("Подключение доступно в приложении macOS."))
}

#[tauri::command]
pub fn publishing_disconnect(platform: Platform, id: String) -> Result<(), PublishError> {
    check_id(platform,&id)?;
    #[cfg(target_os = "macos")]
    return mac::forget(platform,&id);
    #[cfg(not(target_os = "macos"))]
    Ok(())
}

#[tauri::command]
pub async fn publish_text(platform: Platform, id: String, message: String, request_id: String) -> Result<Value, PublishError> {
    let destination = check_id(platform,&id)?;
    let message = message.trim();
    if message.is_empty() || message.chars().count() > 4096 || request_id.len() > 64 || request_id.is_empty()
        || !request_id.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-') {
        return Err(PublishError::rejected("Введите текст до 4096 символов и проверьте идентификатор отправки."));
    }
    #[cfg(target_os = "macos")]
    {
        use serde_json::json;
        let token = mac::token(platform,&id)?;
        match platform {
            Platform::Telegram => {
                let result = mac::telegram(&token,"sendMessage",json!({"chat_id":destination,"text":message})).await?;
                let post_id = result["message_id"].as_i64().filter(|id| *id > 0).ok_or_else(PublishError::uncertain)?;
                let url = result.pointer("/chat/username").and_then(Value::as_str).filter(|name| mac::handle(name))
                    .map(|name| format!("https://t.me/{name}/{post_id}"))
                    .unwrap_or_else(|| format!("https://t.me/c/{}/{post_id}", destination.unsigned_abs().saturating_sub(1_000_000_000_000)));
                Ok(json!({"url":url,"postId":post_id}))
            }
            Platform::Vk => {
                let result = mac::vk(&token,"wall.post",vec![
                    ("owner_id",(-destination).to_string()), ("from_group","1".into()),
                    ("message",message.into()), ("guid",request_id)
                ]).await?;
                let post_id = result["post_id"].as_i64().filter(|id| *id > 0).ok_or_else(PublishError::uncertain)?;
                Ok(json!({"url":format!("https://vk.com/wall-{destination}_{post_id}"),"postId":post_id}))
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    Err(PublishError::rejected("Отправка доступна в приложении macOS."))
}
