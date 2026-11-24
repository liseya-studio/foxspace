import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

const connectionChanged = "fox-vk-connection-changed";
type Connection = { status: "loading" | "browser" | "disconnected" }
  | { status: "connected"; groupId: number }
  | { status: "error"; message: string };

export function useVkConnection(): Connection {
  const [connection, setConnection] = useState<Connection>(() => ({ status: isTauri() ? "loading" : "browser" }));
  useEffect(() => {
    if (!isTauri()) return;
    let revision = 0;
    function refresh() {
      const request = ++revision;
      void invoke<number | null>("vk_connection").then(groupId => {
        if (request === revision) setConnection(groupId ? { status: "connected", groupId } : { status: "disconnected" });
      }).catch(error => {
        if (request === revision) setConnection({ status: "error", message: String(error) });
      });
    }
    refresh();
    window.addEventListener(connectionChanged, refresh);
    return () => {
      revision++;
      window.removeEventListener(connectionChanged, refresh);
    };
  }, []);
  return connection;
}

export async function connectVk(groupId: number, token: string) {
  await invoke("vk_connect", { groupId, token });
  window.dispatchEvent(new Event(connectionChanged));
}

export async function disconnectVk() {
  await invoke("vk_disconnect");
  window.dispatchEvent(new Event(connectionChanged));
}
