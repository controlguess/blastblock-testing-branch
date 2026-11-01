
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (/^https:\/\/([a-z0-9-]+\.)?blastblock\.space$/i.test(origin || '')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

  if (authErr || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      profile: data || {},
      user
    });
  }

  if (req.method === 'POST') {
    const { username, avatar_url, action, game_score, game_streak } = req.body;

    if (action === 'submit_game') {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('high_score, highest_streak')
        .eq('id', user.id)
        .single();

      const currentHighScore = existingProfile?.high_score || 0;
      const currentMaxStreak = existingProfile?.highest_streak || 0;

      const updates = {
        id: user.id,
        high_score: Math.max(currentHighScore, Number(game_score) || 0),
        highest_streak: Math.max(currentMaxStreak, Number(game_streak) || 0),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(updates)
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });

      return res.status(200).json({
        success: true,
        profile: data
      });
    }

    const updates = {
      id: user.id,
      updated_at: new Date().toISOString()
    };

    if (username !== undefined) updates.username = username;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data, error } = await supabase
      .from('profiles')
      .upsert(updates)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({
      success: true,
      profile: data
    });
  }
}
