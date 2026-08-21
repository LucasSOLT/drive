import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yqtsyulvyzgtmxnvddco.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxdHN5dWx2eXpndG14bnZkZGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMDAxOTgsImV4cCI6MjEwMTg3NjE5OH0.F3IfUYmDsiTPZV7odIzdqf0C6Wi1VKf41w_GuCou8GA';

// Use anon key for now - we'll create the table via Supabase Dashboard SQL Editor
const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Generate a random beta token
function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

async function main() {
  const token = generateToken();
  console.log('\n=== BETA INVITE TOKEN ===');
  console.log('Token:', token);
  console.log('URL:   http://localhost:3001/#beta/' + token);
  console.log('========================\n');

  // Try to insert
  const { data, error } = await supabase
    .from('beta_invites')
    .insert({ token, used: false })
    .select();

  if (error) {
    console.error('Insert error:', error.message);
    console.log('\nIf the table does not exist, run this SQL in Supabase Dashboard → SQL Editor:\n');
    console.log(`CREATE TABLE beta_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text UNIQUE NOT NULL,
  used boolean DEFAULT false,
  used_by text,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz
);

-- Allow anon to read and update beta_invites
ALTER TABLE beta_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read beta invites" ON beta_invites FOR SELECT USING (true);
CREATE POLICY "Anyone can update beta invites" ON beta_invites FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert beta invites" ON beta_invites FOR INSERT WITH CHECK (true);
`);
  } else {
    console.log('✅ Token inserted successfully!');
    console.log('Data:', JSON.stringify(data, null, 2));
  }
}

main();
