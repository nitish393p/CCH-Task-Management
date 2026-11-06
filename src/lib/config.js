const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const key = publishableKey || anonKey;
const hasUrl = Boolean(url);
const hasKey = Boolean(key);

let validUrl = false;
try {
  const parsedUrl = new URL(url);
  validUrl = parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
} catch {
  validUrl = false;
}

export const CONFIG = { url, anon: key };
export const CONFIG_ERROR = hasUrl !== hasKey
  ? "Set both VITE_SUPABASE_URL and a publishable key in your .env file."
  : hasUrl && !validUrl
    ? "VITE_SUPABASE_URL must be a valid http:// or https:// URL."
    : "";
// Demo mode runs entirely in the browser when no Supabase credentials are configured.
export const DEMO = !hasUrl && !hasKey;
