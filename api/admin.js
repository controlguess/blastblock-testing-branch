import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
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

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile || !profile.is_admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    if (req.method === 'GET') {
      const { type } = req.query;
      if (type === 'users') {
        const { data: users, error } = await supabase
          .from('profiles')
          .select('id, username, high_score, highest_streak, coins, is_admin, updated_at')
          .order('high_score', { ascending: false });
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true, users });
      }
      return res.status(400).json({ error: 'Invalid admin query type' });
    }

    if (req.method === 'POST') {
      const { action, targetUserId, isAdmin, catalogItem } = req.body || {};

      if (action === 'update_user_admin') {
        const { data, error } = await supabase
          .from('profiles')
          .update({ is_admin: Boolean(isAdmin) })
          .eq('id', targetUserId)
          .select()
          .single();

        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true, profile: data });
      }

      if (action === 'create_item') {
        return res.status(200).json({ success: true, message: 'Item created successfully', item: catalogItem });
      }

      return res.status(400).json({ action, error: 'Unknown admin action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Admin API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
