const axios = require('axios');

const VIXSRC_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://cinesrc.st/',
    'Origin': 'https://cinesrc.st'
};

async function getVixsrcStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    console.log(`[Vixsrc] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

    try {
        const type = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
        const embedUrl = type === 'movie'
            ? `https://cinesrc.st/embed/movie/${tmdbId}`
            : `https://cinesrc.st/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}`;

        const encRes = await axios.get(
            `https://enc-dec.app/api/enc-cinesrc?text=${encodeURIComponent(embedUrl)}&agent=${encodeURIComponent(VIXSRC_HEADERS['User-Agent'])}`,
            { timeout: 8000 }
        );
        const tokenData = encRes.data?.result || encRes.data;
        if (!tokenData || !tokenData.token) return [];

        const cinesrcRes = await axios.get(`https://cinesrc.st/api/stream/${tokenData.token}`, {
            headers: {
                ...VIXSRC_HEADERS,
                ...(tokenData.headers || {})
            },
            timeout: 8000
        });

        const encryptedPayload = typeof cinesrcRes.data === 'string' ? cinesrcRes.data : JSON.stringify(cinesrcRes.data);

        const decRes = await axios.post(
            'https://enc-dec.app/api/dec-cinesrc',
            { text: encryptedPayload, id: String(tmdbId) },
            { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
        );

        const resData = decRes.data?.result || decRes.data;
        const streams = [];

        if (resData && Array.isArray(resData.sources)) {
            for (const s of resData.sources) {
                if (!s.url) continue;
                streams.push({
                    name: `Vixsrc - ${s.quality || 'Auto'}`,
                    title: `Vixsrc - ${s.quality || 'Auto'}`,
                    url: s.url,
                    quality: s.quality || 'Auto',
                    provider: 'Vixsrc',
                    headers: VIXSRC_HEADERS
                });
            }
        } else if (resData && (resData.url || resData.file)) {
            streams.push({
                name: 'Vixsrc',
                title: 'Vixsrc - Auto',
                url: resData.url || resData.file,
                quality: 'Auto',
                provider: 'Vixsrc',
                headers: VIXSRC_HEADERS
            });
        }

        console.log(`[Vixsrc] Successfully extracted ${streams.length} stream(s).`);
        return streams;
    } catch (err) {
        console.error(`[Vixsrc] Error: ${err.message}`);
        return [];
    }
}

module.exports = { getVixsrcStreams };
