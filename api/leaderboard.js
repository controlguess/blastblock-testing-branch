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
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, high_score, highest_streak, active_frame')
      .order('high_score', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

    return res.status(200).json({
      success: true,
      data: data || []
    });

  } catch (err) {
    console.error('Leaderboard API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
