/** The file name a media URL points at, decoded, or "" when there is none to show. */
export function fileNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return "";
  let path: string;
  try {
    path = new URL(trimmed).pathname;
  } catch {
    // A relative path: the part before any query or fragment.
    path = trimmed.split(/[?#]/, 1)[0] ?? "";
  }
  const last = path.replace(/\/+$/, "").split("/").pop() ?? "";
  if (!last) return "";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
