export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const functionsUrl = supabaseUrl
  ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1`
  : "";
