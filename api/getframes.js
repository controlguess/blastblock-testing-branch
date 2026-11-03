export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/shop_frames?select=*`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).json({ success: false, error: errText });
        }

        const frames = await response.json();

        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

        return res.status(200).json({
            success: true,
            frames: frames
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
}
