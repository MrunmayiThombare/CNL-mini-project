import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only instantiated when Supabase mode is actually used, so the Express-only
// setup doesn't require these env vars to be present.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
