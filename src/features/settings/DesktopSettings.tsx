import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getAutoLaunchState, setAutoLaunchState } from "../automations/autostart";
import { sendAutomationTest } from "../automations/data";
import { disableDesktopReminders, dispatchDesktopReminders, enableDesktopReminders, getReminderPreferences } from "../notifications/data";

export function ReminderSettings() {
  const [enabled, setEnabled] = useState(() => getReminderPreferences().enabled);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const refresh = () => setEnabled(getReminderPreferences().enabled);
    window.addEventListener("fox-notifications-updated", refresh);
    return () => window.removeEventListener("fox-notifications-updated", refresh);
  }, []);

  async function toggle() {
    setBusy(true);
    setStatus("");
    try {
      if (enabled) disableDesktopReminders();
      else if (await enableDesktopReminders()) void dispatchDesktopReminders();
      else setStatus("Разрешите уведомления в настройках macOS или браузера.");
    } catch {
      setStatus("Не удалось изменить разрешение на уведомления.");
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    const sent = await sendAutomationTest("Fox Space", "Это пробное уведомление.", "fox-space-connection-test");
    setStatus(sent ? "Пробное уведомление отправлено." : "Не удалось отправить. Проверьте системное разрешение.");
  }

  return <section className="fox-setting-card">
    <h3>Напоминания о задачах</h3>
    <p>Показываются в день срока, пока Fox Space открыт.</p>
    <div className="fox-setting-actions">
      <button type="button" role="switch" aria-checked={enabled} aria-label="Напоминания о задачах" className="outline-button" disabled={busy} onClick={()=>void toggle()}>{enabled ? "Включены" : "Выключены"}</button>
      <button type="button" className="outline-button" disabled={!enabled || busy} onClick={()=>void test()}>Проверить уведомление</button>
    </div>
    {status && <p role="status">{status}</p>}
  </section>;
}

export function AutoLaunchSettings() {
  const [enabled, setEnabled] = useState<boolean|null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    let active = true;
    if (isTauri()) void getAutoLaunchState().then(value=>{if(active)setEnabled(value);}).catch(()=>{if(active)setProblem("Не удалось проверить автозапуск.");});
    return ()=>{active=false;};
  }, []);

  async function toggle() {
    setBusy(true);
    setProblem("");
    try { setEnabled(await setAutoLaunchState(!enabled)); }
    catch { setProblem("Не удалось изменить автозапуск."); }
    finally { setBusy(false); }
  }

  if (!isTauri()) return null;
  return <section className="fox-setting-card">
    <h3>Запуск при входе в macOS</h3>
    <button type="button" role="switch" aria-checked={enabled ?? false} aria-label="Запуск при входе в macOS" className="outline-button" disabled={enabled===null || busy} onClick={()=>void toggle()}>{enabled===null ? "Проверяем…" : enabled ? "Включён" : "Выключен"}</button>
    {problem && <p role="alert">{problem}</p>}
  </section>;
}
