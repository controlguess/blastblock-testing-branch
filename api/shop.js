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

    // Fetch themes and frames catalogs from database concurrently
    const [themesRes, framesRes] = await Promise.all([
      supabase.from('shop_themes').select('*').order('cost', { ascending: true }),
      supabase.from('shop_frames').select('*').order('cost', { ascending: true })
    ]);

    if (themesRes.error) throw themesRes.error;
    if (framesRes.error) throw framesRes.error;

    // Cache responses at the edge for 30 seconds
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    return res.status(200).json({
      success: true,
      shop: {
        themes: themesRes.data || [],
        frames: framesRes.data || []
      }
    });

  } catch (err) {
    console.error('Shop API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
