// Clip/VOD URLs reach the client via untyped JSON (event_data blobs, server
// action results), so validate before handing them to window.open: a
// javascript: URL there would execute as script. Only https twitch.tv links
// are ever expected here.
const TWITCH_HOST = /(^|\.)twitch\.tv$/;

export function openTwitchUrl(url: string | undefined): void {
  if (!url) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== "https:" || !TWITCH_HOST.test(parsed.hostname)) return;
  window.open(parsed.href, "_blank", "noopener,noreferrer");
}
