/**
 * auth.ts — re-exports from AuthContext for backward compatibility.
 *
 * All auth state is now managed in a single React context (AuthProvider).
 * Import useAuth from here or directly from ./AuthContext — both work.
 */
export { useAuth, AuthProvider, OAUTH_CALLBACK_URL } from "./AuthContext";
export type { AuthContextValue as AuthState } from "./AuthContext";
