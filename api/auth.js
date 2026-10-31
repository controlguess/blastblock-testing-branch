import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, username } = req.body;

  try {
    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username || email.split('@')[0], avatar_url: '' } }
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: username || email.split('@')[0],
          high_score: 0,
          highest_streak: 0,
          last_login: new Date().toISOString()
        });
      }

      return res.status(200).json({ success: true, user: data.user, session: data.session });
    }

    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      await supabase.from('profiles').update({
        last_login: new Date().toISOString()
      }).eq('id', data.user.id);

      return res.status(200).json({ success: true, user: data.user, session: data.session });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
