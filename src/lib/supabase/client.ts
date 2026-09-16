import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Project URL only, e.g. https://xxxx.supabase.co — never /rest/v1 or /auth/v1. */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return "";
  try {
    const url = new URL(value);
    // Strip accidental API paths copied from the dashboard
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.origin;
  } catch {
    return value.replace(/\/(rest|auth|storage|functions)\/v1.*$/i, "").replace(/\/+$/, "");
  }
}

export function isSupabaseConfigured() {
  return Boolean(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !key) {
    throw new Error(
      "Supabase ist nicht konfiguriert. Setze NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local bzw. Vercel.",
    );
  }

  if (!browserClient) {
    if (/\/(rest|auth)\/v1/i.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
      console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL enthielt einen API-Pfad und wurde auf die Project-URL gekürzt:",
        url,
      );
    }
    browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
