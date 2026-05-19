/**
 * Parse a YouTube watch / share / embed / shorts URL to the canonical 11-char video id.
 * Returns null if the URL is not a recognized YouTube link.
 */
export function parseYouTubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  const allowedHosts = new Set([
    "youtube.com",
    "youtube-nocookie.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
  ]);
  if (!allowedHosts.has(host)) return null;

  const normalizeId = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const clean = id.split(/[?&#]/)[0] ?? id;
    if (clean.length < 6 || clean.length > 32) return null;
    if (!/^[a-zA-Z0-9_-]+$/.test(clean)) return null;
    return clean;
  };

  if (host === "youtu.be") {
    return normalizeId(url.pathname.split("/").filter(Boolean)[0]);
  }

  if (url.pathname === "/watch" || url.pathname.startsWith("/watch")) {
    return normalizeId(url.searchParams.get("v"));
  }

  const embed = url.pathname.match(/^\/embed\/([^/?]+)/);
  if (embed?.[1]) return normalizeId(embed[1]);

  const shorts = url.pathname.match(/^\/shorts\/([^/?]+)/);
  if (shorts?.[1]) return normalizeId(shorts[1]);

  return null;
}

/** True if the string is a plausible YouTube watch URL we accept on create. */
export function isYouTubeWatchUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    const allowed = [
      "www.youtube.com",
      "youtube.com",
      "m.youtube.com",
      "youtu.be",
      "www.youtube-nocookie.com",
      "music.youtube.com",
    ];
    if (!allowed.includes(host)) return false;
    return parseYouTubeVideoId(raw) !== null;
  } catch {
    return false;
  }
}
