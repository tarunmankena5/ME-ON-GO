/** Production auth uses Supabase email/password; demo mode intentionally has no sign-in. */
export type AuthUser = {
  id: string;
  email: string;
};

export interface AuthProvider {
  signUp(email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
}
