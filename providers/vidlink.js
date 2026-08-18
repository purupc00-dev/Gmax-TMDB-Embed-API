const axios = require('axios');

const VIDLINK_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://vidlink.pro/',
    'Origin': 'https://vidlink.pro'
};

async function getVidlinkStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    console.log(`[Vidlink] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

    try {
        const encRes = await axios.get(
            `https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(String(tmdbId))}`,
            { timeout: 8000 }
        );
        const encodedTmdb = encRes.data?.result || encRes.data?.text || encRes.data;
        if (!encodedTmdb || typeof encodedTmdb !== 'string') {
            console.log('[Vidlink] Encryption step returned no result.');
            return [];
        }

        const type = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
        const apiUrl = type === 'tv'
            ? `https://vidlink.pro/api/b/tv/${encodedTmdb}/${seasonNum}/${episodeNum}?multiLang=0`
            : `https://vidlink.pro/api/b/movie/${encodedTmdb}?multiLang=0`;

        const apiRes = await axios.get(apiUrl, { headers: VIDLINK_HEADERS, timeout: 8000 });

        const playlist = apiRes.data?.stream?.playlist || apiRes.data?.playlist;
        if (!playlist) {
            console.log('[Vidlink] No playlist URL in response.');
            return [];
        }

        console.log(`[Vidlink] Got stream.`);
        return [{
            name: 'Vidlink',
            title: 'Vidlink',
            url: playlist,
            quality: 'Auto',
            provider: 'Vidlink',
            headers: VIDLINK_HEADERS
        }];
    } catch (err) {
        console.error(`[Vidlink] Error: ${err.message}`);
        return [];
    }
}

module.exports = { getVidlinkStreams };
