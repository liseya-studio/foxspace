import { invoke, isTauri } from "@tauri-apps/api/core";

export async function saveDownload(blob: Blob, filename: string): Promise<boolean> {
  const name = filename.replace(/[\\/:\x00-\x1f]/g, "_").trim() || "Fox Space";
  if (isTauri()) {
    if (blob.size > 150 * 1024 * 1024) throw new Error("Размер файла превышает 150 МБ.");
    const encodedName = new TextEncoder().encode(Array.from(name).slice(0, 120).join(""));
    const request = new Uint8Array(2 + encodedName.length + blob.size);
    new DataView(request.buffer).setUint16(0, encodedName.length);
    request.set(encodedName, 2);
    request.set(new Uint8Array(await blob.arrayBuffer()), 2 + encodedName.length);
    return invoke<boolean>("save_workspace_export", request.buffer);
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
  return true;
}

export function initDesktopLinks() {
  if (!isTauri()) return;
  document.addEventListener("click", event => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!link || event.defaultPrevented || !["https:", "http:", "mailto:"].includes(link.protocol)) return;
    if (link.origin === window.location.origin && link.target !== "_blank") return;
    event.preventDefault();
    void invoke("open_external_link", { url: link.href }).catch(error => window.alert(String(error)));
  });
}
