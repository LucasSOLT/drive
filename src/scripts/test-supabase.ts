import { supabase } from '../lib/supabase.ts';

// Quick connection test — run with: npx tsx src/scripts/test-supabase.ts
async function testConnection() {
  console.log('🔌 Testing Supabase connection...\n');

  // Test 1: Can we reach the database?
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  console.log('📋 profiles table:', pErr ? `❌ ${pErr.message}` : `✅ Connected (${profiles?.length ?? 0} rows)`);

  const { data: stories, error: sErr } = await supabase.from('stories').select('*').limit(1);
  console.log('📖 stories  table:', sErr ? `❌ ${sErr.message}` : `✅ Connected (${stories?.length ?? 0} rows)`);

  const { data: interactions, error: iErr } = await supabase.from('story_interactions').select('*').limit(1);
  console.log('💕 interactions table:', iErr ? `❌ ${iErr.message}` : `✅ Connected (${interactions?.length ?? 0} rows)`);

  // Test 2: Can we write? Insert a test profile then delete it.
  console.log('\n📝 Testing write access...');
  const testUsername = `Test_Connection_${Date.now()}`;
  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({ username: testUsername })
    .select()
    .single();

  if (insertErr) {
    console.log('❌ Insert failed:', insertErr.message);
  } else {
    console.log('✅ Insert OK:', inserted.username);
    // Clean up
    const { error: delErr } = await supabase.from('profiles').delete().eq('id', inserted.id);
    console.log(delErr ? `⚠️ Cleanup failed: ${delErr.message}` : '🧹 Cleanup OK (test row deleted)');
  }

  console.log('\n✨ Connection test complete!');
}

testConnection();
