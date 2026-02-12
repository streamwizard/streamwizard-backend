/**
 * Normalize Twitch API endpoints to prevent label cardinality explosion.
 * Replaces dynamic values (IDs, tokens) with placeholders.
 *
 * Examples:
 * - /users?id=123 → /users?id=:id
 * - /channels?broadcaster_id=456 → /channels?broadcaster_id=:id
 * - /streams?user_id=789&first=20 → /streams?user_id=:id&first=:value
 */
export function normalizeEndpoint(url: string): string {
  if (!url) return "unknown";

  try {
    // Handle full URLs or just paths
    const urlObj = url.startsWith("http") ? new URL(url) : new URL(url, "https://api.twitch.tv");

    // Get the path without the base
    let path = urlObj.pathname;

    // Remove /helix prefix if present
    if (path.startsWith("/helix")) {
      path = path.slice(6);
    }

    // Normalize path segments (replace numeric IDs)
    const normalizedPath = path
      .split("/")
      .map((segment) => {
        // Replace numeric IDs in path with :id
        if (/^\d+$/.test(segment)) {
          return ":id";
        }
        return segment;
      })
      .join("/");

    // Normalize query parameters
    const normalizedParams: string[] = [];
    urlObj.searchParams.forEach((_, key) => {
      // Common ID parameters
      const idParams = [
        "id",
        "user_id",
        "broadcaster_id",
        "moderator_id",
        "game_id",
        "reward_id",
        "clip_id",
        "video_id",
        "from_broadcaster_id",
        "to_broadcaster_id",
      ];

      // Parameters to normalize to :value
      const valueParams = ["after", "before", "cursor", "first", "started_at", "ended_at"];

      if (idParams.includes(key)) {
        normalizedParams.push(`${key}=:id`);
      } else if (valueParams.includes(key)) {
        normalizedParams.push(`${key}=:value`);
      } else {
        // Keep the key but normalize unknown values
        normalizedParams.push(`${key}=:value`);
      }
    });

    // Sort params for consistent labels
    normalizedParams.sort();

    if (normalizedParams.length > 0) {
      return `${normalizedPath}?${normalizedParams.join("&")}`;
    }

    return normalizedPath || "/";
  } catch {
    // If URL parsing fails, do basic normalization
    return url
      .replace(/\d{5,}/g, ":id") // Replace long numeric sequences
      .replace(/=[^&]+/g, "=:value"); // Replace query values
  }
}
