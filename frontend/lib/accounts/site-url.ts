import "server-only";
export function siteOrigin(): string | null {
  const raw =
    process.env.SITE_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash) return null;
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
