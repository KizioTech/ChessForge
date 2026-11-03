/**
 * AuthContext — single source of truth for authentication state.
 *
 * Wrap the app root in <AuthProvider>. Every component that calls useAuth()
 * shares the same session, user, and profile — no duplicate listeners, no
 * stale state after sign-in/sign-out.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, getCurrentProfile, type UserProfile } from "./supabase";

export const OAUTH_CALLBACK_URL = "https://rjxpuxmwdcqgierciqpg.supabase.co/auth/v1/callback";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Restore existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        getCurrentProfile().then(setProfile);
      }
      setLoading(false);
    });

    // Single global listener — all components share this update
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        getCurrentProfile().then(setProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithPassword(email: string, password: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) return { error: new Error("Supabase is not configured in .env") };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  }

  async function signUpWithPassword(email: string, password: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) return { error: new Error("Supabase is not configured in .env") };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: OAUTH_CALLBACK_URL }
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function signInWithGoogle(): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) return { error: new Error("Supabase is not configured in .env") };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: OAUTH_CALLBACK_URL }
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function signInWithEmail(email: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured) return { error: new Error("Supabase is not configured in .env") };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: OAUTH_CALLBACK_URL }
    });
    return { error: error ? new Error(error.message) : null };
  }

  async function signOut(): Promise<void> {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }

  async function refreshProfile(): Promise<void> {
    const p = await getCurrentProfile();
    setProfile(p);
  }

  const value: AuthContextValue = {
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
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Consume auth context — throws if used outside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

