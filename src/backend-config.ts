// These values are public by design; authorization remains in the Edge Function/RLS.
export const SUPABASE_URL=(import.meta.env?.VITE_SUPABASE_URL||'https://enhnlektomuoumozjsfp.supabase.co').replace(/\/$/,'');
export const PUBLIC_KEY=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_LFHmQPmST9OoX2XUzcuXkw_3HMOmLja';
export const ENDPOINT=SUPABASE_URL+'/functions/v1/lovekoala-api';
