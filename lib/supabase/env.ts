export type SupabaseEnvironment = {
  url: string;
  anonKey: string;
};

export function isSupabaseEnvironmentConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim());
}

export function getSupabaseEnvironment(): SupabaseEnvironment {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase mode requires SUPABASE_URL and SUPABASE_ANON_KEY. Set LIFELOG_DATA_MODE=demo to work locally without Supabase.",
    );
  }

  return { url, anonKey };
}
