import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || "";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

export interface UserProfile {
  id: string;
  display_name: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  try {
    // Read session from local cache first — avoids network timeout on getUser()
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    // Fast timeout race to prevent slow network / timeout from hanging the app
    const timeoutPromise = new Promise<{ data: null; error: Error }>(resolve =>
      setTimeout(() => resolve({ data: null, error: new Error("Profile network timeout") }), 2000)
    );

    const fetchPromise = supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (error || !data) {
      return null;
    }

    return data as UserProfile;
  } catch {
    return null;
  }
}

