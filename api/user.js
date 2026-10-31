import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error && error.code !== 'PGRST116') return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true, profile: data || {}, user });
  }

  if (req.method === 'POST') {
    const { username, avatar_url, high_score, highest_streak } = req.body;

    const updates = {
      id: user.id,
      updated_at: new Date().toISOString()
    };

    if (username !== undefined) updates.username = username;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (high_score !== undefined) updates.high_score = high_score;
    if (highest_streak !== undefined) updates.highest_streak = highest_streak;

    const { data, error } = await supabase.from('profiles').upsert(updates).select().single();
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ success: true, profile: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
