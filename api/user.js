import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
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

    if (req.method === 'GET') {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileErr) throw profileErr;
      return res.status(200).json({ success: true, profile, user });
    }

    if (req.method === 'POST') {
      const { action, sessionId, game_score, game_streak } = req.body || {};

      if (action === 'submit_game') {
        if (!sessionId) {
          return res.status(400).json({ error: 'Missing game session ID' });
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
        const safeScore = Math.max(0, Math.floor(Number(game_score) || 0));
        const safeStreak = Math.max(0, Math.floor(Number(game_streak) || 0));
        const minExpectedSeconds = Math.max(3, (safeScore / 1000) * 10);

        if (elapsedSeconds < minExpectedSeconds) {
          await supabase.from('game_sessions').update({ status: 'expired' }).eq('id', sessionId);
          return res.status(400).json({ error: 'Score rejected: Game completed suspiciously fast.' });
        }

        await supabase
          .from('game_sessions')
          .update({ status: 'completed' })
          .eq('id', sessionId);

        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('high_score, highest_streak, coins')
          .eq('id', user.id)
          .single();

        const earnedCoins = Math.floor(safeScore / 10);
        const newHighScore = Math.max(currentProfile?.high_score || 0, safeScore);
        const newHighestStreak = Math.max(currentProfile?.highest_streak || 0, safeStreak);
        const newCoins = (currentProfile?.coins || 0) + earnedCoins;

        const { data: updatedProfile, error: updateErr } = await supabase
          .from('profiles')
          .update({
            high_score: newHighScore,
            highest_streak: newHighestStreak,
            coins: newCoins,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        return res.status(200).json({ success: true, profile: updatedProfile });
      }

      const { username, avatar_url, active_theme, active_frame } = req.body || {};
      const { data: currentProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('unlocked_items')
        .eq('id', user.id)
        .single();

      if (profileErr) throw profileErr;

      const unlocked = currentProfile.unlocked_items || ['default', 'frame-none'];
      const updatePayload = { updated_at: new Date().toISOString() };

      if (username !== undefined) updatePayload.username = username;
      if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;
      if (active_theme !== undefined && unlocked.includes(active_theme)) {
        updatePayload.active_theme = active_theme;
      }
      if (active_frame !== undefined && unlocked.includes(active_frame)) {
        updatePayload.active_frame = active_frame;
      }

      const { data: updated, error: upErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)
        .select()
        .single();

      if (upErr) throw upErr;
      return res.status(200).json({ success: true, profile: updated, user });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
