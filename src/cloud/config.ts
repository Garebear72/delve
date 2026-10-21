// Supabase project for cloud saves. Both values are safe to publish: the anon key only allows what the
// database's row-level security permits (each player can read and write only their own saves).
// Leave them empty to turn cloud saves off. Setup steps: supabase/setup.sql and CLAUDE.md ("Cloud saves").
export const SUPABASE_URL = 'https://loujqbrtfwqdychvhxps.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_cfRSCps_G1vYbLhPXYgmjQ_rtxWUMEw';
/** The cloud-save account that can open the visitor log (admin.html); supabase/visits.sql enforces it. */
export const ADMIN_USER = 'garebear';
export const cloudConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
