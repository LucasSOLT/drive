import { createClient } from '@supabase/supabase-js';

// ─── Supabase Configuration ───
// Project: DRiVE
// Dashboard: https://supabase.com/dashboard/project/yqtsyulvyzgtmxnvddco

const SUPABASE_URL = 'https://yqtsyulvyzgtmxnvddco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxdHN5dWx2eXpndG14bnZkZGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMDAxOTgsImV4cCI6MjEwMTg3NjE5OH0.F3IfUYmDsiTPZV7odIzdqf0C6Wi1VKf41w_GuCou8GA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
