import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const { sessionId, score, coins } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing game session ID' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session || session.status !== 'active') {
      return res.status(403).json({ error: 'Invalid or expired game session' });
    }

    const startTime = new Date(session.started_at).getTime();
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const minExpectedSeconds = Math.max(3, (score / 1000) * 10);

    if (elapsedSeconds < minExpectedSeconds) {
      await supabase.from('game_sessions').update({ status: 'expired' }).eq('id', sessionId);
      return res.status(400).json({ error: 'Score rejected: suspicious completion speed.' });
    }

    await supabase
      .from('game_sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('coins, high_score')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const newCoins = (profile.coins || 0) + (coins || 0);
    const newHighScore = Math.max(profile.high_score || 0, score || 0);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ coins: newCoins, high_score: newHighScore })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true, coins: newCoins, highScore: newHighScore });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
