const axios = require('axios');
const { getTmdbApiKey } = require('../utils/tmdbKey');

const VIDEASY_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    // CHANGED: New Origin and Referer
    'Origin': 'https://player.videasy.to',
    'Referer': 'https://player.videasy.to/'
};

// CHANGED: Replaced api.videasy.net with api.speedracelight.com and updated paths
const SERVERS = {
    'Neon':   { url: 'https://api.speedracelight.com/vsrc/sources-with-title' },
    'Yoru':   { url: 'https://api.speedracelight.com/cdn/sources-with-title', moviesOnly: true },
    'Cypher': { url: 'https://api.speedracelight.com/moviebox/sources-with-title' },
    'Reyna':  { url: 'https://api.speedracelight.com/primewire/sources-with-title' },
    'Omen':   { url: 'https://api.speedracelight.com/lamovie/sources-with-title' },
    'Breach': { url: 'https://api.speedracelight.com/m4uhd/sources-with-title' },
    'Ghost':  { url: 'https://api.speedracelight.com/primesrcme/sources-with-title' },
    'Sage':   { url: 'https://api.speedracelight.com/1movies/sources-with-title' },
    'Vyse':   { url: 'https://api.speedracelight.com/hdmovie/sources-with-title' },
    'Raze':   { url: 'https://api.speedracelight.com/superflix/sources-with-title' }
};

const DECRYPT_URL = 'https://enc-dec.app/api/dec-videasy';

async function getVideasyStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    console.log(`[Videasy] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

    const tmdbKey = getTmdbApiKey();
    if (!tmdbKey) {
        console.error('[Videasy] No TMDB API key configured.');
        return [];
    }

    // Step 1: Resolve title/year/imdbId from TMDB
    let details;
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const { data } = await axios.get(
            `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${tmdbKey}&append_to_response=external_ids`,
            { timeout: 8000 }
        );
        details = {
            title: data.title || data.name || '',
            year: (data.release_date || data.first_air_date || '').split('-')[0],
            imdbId: (data.external_ids && data.external_ids.imdb_id) || '',
            type
        };
    } catch (err) {
        console.error(`[Videasy] TMDB lookup failed: ${err.message}`);
        return [];
    }

    if (!details.title) {
        console.error('[Videasy] No title returned from TMDB.');
        return [];
    }

    // ADDED: Fetch the new required security seed
    let seed = "";
    try {
        const seedRes = await axios.get(`https://api.speedracelight.com/seed?mediaId=${tmdbId}`, {
            headers: VIDEASY_HEADERS,
            timeout: 5000
        });
        seed = seedRes.data.seed;
    } catch (err) {
        console.error(`[Videasy] Failed to fetch security seed: ${err.message}`);
        return [];
    }

    // ADDED: Double URL encode the title
    const encTitle = encodeURIComponent(encodeURIComponent(details.title));

    const allStreams = [];
    const seen = new Set();

    // Step 2: Query each server in parallel
    await Promise.all(Object.entries(SERVERS).map(async ([name, server]) => {
        if (server.moviesOnly && mediaType === 'tv') return;

        // CHANGED: Use encTitle and add enc=2 & seed parameters
        let apiUrl = `${server.url}?title=${encTitle}`
            + `&mediaType=${details.type}&year=${details.year}`
            + `&tmdbId=${tmdbId}&imdbId=${details.imdbId || ''}&enc=2&seed=${seed}`;
        if (mediaType === 'tv') apiUrl += `&seasonId=${seasonNum}&episodeId=${episodeNum}`;

        try {
            const encRes = await axios.get(apiUrl, {
                headers: VIDEASY_HEADERS,
                timeout: 8000,
                responseType: 'text'
            });

            const encryptedText = typeof encRes.data === 'string' ? encRes.data : JSON.stringify(encRes.data);
            if (!encryptedText || encryptedText.length < 20 || encryptedText.startsWith('<')) return;

            // Step 3: Decrypt via enc-dec.app
            // CHANGED: Include the seed in the payload
            const decRes = await axios.post(DECRYPT_URL,
                { text: encryptedText, id: String(tmdbId), seed: seed },
                { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
            );

            const resData = (decRes.data && decRes.data.result) || decRes.data;
            if (!resData || !Array.isArray(resData.sources)) return;

            for (const s of resData.sources) {
                if (!s.url || seen.has(s.url)) continue;
                seen.add(s.url);
                allStreams.push({
                    name: `Videasy ${name}`,
                    title: `Videasy ${name} - ${s.quality || 'Auto'}`,
                    url: s.url,
                    quality: s.quality || 'Auto',
                    provider: 'Videasy',
                    headers: {
                        // CHANGED: Output the new referer domains back to the client
                        'Referer': 'https://player.videasy.to/',
                        'Origin': 'https://player.videasy.to'
                    }
                });
            }
            console.log(`[Videasy] Server ${name}: ${resData.sources.length} source(s)`);
        } catch {
            // server unreachable or returned no data — skip silently
        }
    }));

    console.log(`[Videasy] Total streams: ${allStreams.length}`);
    return allStreams;
}

module.exports = { getVideasyStreams };
