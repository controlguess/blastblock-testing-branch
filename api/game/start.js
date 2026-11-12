import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (/^https:\/\/([a-z0-9-]+\.)?blastblock\.space$/i.test(origin || '')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    await supabase
      .from('game_sessions')
      .update({ status: 'expired' })
      .eq('user_id', user.id)
      .eq('status', 'active');

    const { data, error } = await supabase
      .from('game_sessions')
      .insert([{ user_id: user.id, status: 'active' }])
      .select('id, started_at')
      .single();

    if (error) throw error;

    return res.status(200).json({ sessionId: data.id, startedAt: data.started_at });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
