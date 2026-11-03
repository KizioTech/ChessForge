import { useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, getCurrentProfile, type UserProfile } from "./supabase";

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
}

export const OAUTH_CALLBACK_URL = "https://rjxpuxmwdcqgierciqpg.supabase.co/auth/v1/callback";

export function useAuth(): AuthState & {
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        getCurrentProfile().then(p => {
          if (isMounted) setProfile(p);
        });
      }
      setLoading(false);
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        getCurrentProfile().then(p => {
          if (isMounted) setProfile(p);
        });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signInWithPassword(email: string, password: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      return { error: new Error("Supabase is not configured in .env") };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function signUpWithPassword(email: string, password: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      return { error: new Error("Supabase is not configured in .env") };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: OAUTH_CALLBACK_URL
      }
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function signInWithGoogle(): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      return { error: new Error("Supabase is not configured in .env") };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: OAUTH_CALLBACK_URL
      }
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function signInWithEmail(email: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) {
      return { error: new Error("Supabase is not configured in .env") };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: OAUTH_CALLBACK_URL
      }
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function signOut(): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }

  async function refreshProfile(): Promise<void> {
    const p = await getCurrentProfile();
    setProfile(p);
  }

  return {
    user,
    session,
    profile,
    loading,
    isConfigured: isSupabaseConfigured,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signInWithEmail,
    signOut,
    refreshProfile
  };
}
