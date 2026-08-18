const axios = require('axios');
const { getTmdbApiKey } = require('../utils/tmdbKey');

const LORDFLIX_HEADERS = {
    'Accept': '*/*',
    'Origin': 'https://yflix.to',
    'Referer': 'https://yflix.to/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
};

const MULTI_DECRYPT_API = 'https://enc-dec.app/api';

async function getLordflixStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    console.log(`[Lordflix] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

    const tmdbKey = getTmdbApiKey();
    if (!tmdbKey) {
        console.error('[Lordflix] No TMDB API key configured.');
        return [];
    }

    try {
        const type = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
        
        // Find yFlix ID from database using tmdb_id
        const dbRes = await axios.get(`https://enc-dec.app/db/flix/find?tmdb_id=${tmdbId}`, { timeout: 8000 });
        const flixData = dbRes.data?.result || dbRes.data;
        if (!flixData || !flixData.id) {
            console.log('[Lordflix] Content ID not found in database.');
            return [];
        }

        const contentId = flixData.id;
        let targetEid = contentId;

        if (type === 'tv') {
            const encEpRes = await axios.get(`${MULTI_DECRYPT_API}/enc-movies-flix?text=${encodeURIComponent(contentId)}`, { timeout: 8000 });
            const encEp = encEpRes.data?.result || encEpRes.data;

            const epListRes = await axios.get(`https://yflix.to/ajax/episodes/list?id=${contentId}&_=${encEp}`, {
                headers: LORDFLIX_HEADERS,
                timeout: 8000
            });
            const epData = epListRes.data;
            if (epData && Array.isArray(epData.episodes)) {
                const foundEp = epData.episodes.find(ep => ep.season === Number(seasonNum) && ep.episode === Number(episodeNum));
                targetEid = foundEp ? foundEp.id : epData.episodes[0]?.id;
            }
        }

        if (!targetEid) return [];

        const encEidRes = await axios.get(`${MULTI_DECRYPT_API}/enc-movies-flix?text=${encodeURIComponent(targetEid)}`, { timeout: 8000 });
        const encEid = encEidRes.data?.result || encEidRes.data;

        const serversRes = await axios.get(`https://yflix.to/ajax/links/list?eid=${targetEid}&_=${encEid}`, {
            headers: LORDFLIX_HEADERS,
            timeout: 8000
        });

        const serverList = serversRes.data?.result || serversRes.data;
        if (!Array.isArray(serverList) || serverList.length === 0) return [];

        const streams = [];

        await Promise.all(serverList.map(async (srv) => {
            try {
                const sId = srv.id || srv.lid;
                if (!sId) return;

                const encSrvRes = await axios.get(`${MULTI_DECRYPT_API}/enc-movies-flix?text=${encodeURIComponent(sId)}`, { timeout: 8000 });
                const encSrv = encSrvRes.data?.result || encSrvRes.data;

                const embedRes = await axios.get(`https://yflix.to/ajax/links/view?id=${sId}&_=${encSrv}`, {
                    headers: LORDFLIX_HEADERS,
                    timeout: 8000
                });

                const rawResult = embedRes.data?.result || embedRes.data;
                if (!rawResult) return;

                const decRes = await axios.post(`${MULTI_DECRYPT_API}/dec-movies-flix`,
                    { text: typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult) },
                    { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
                );

                const finalStream = decRes.data?.result || decRes.data;
                const playUrl = finalStream?.url || finalStream?.file || finalStream?.stream;

                if (playUrl) {
                    streams.push({
                        name: `Lordflix[${srv.name || 'Server'}]`,
                        title: `Lordflix[${srv.name || 'Server'}]`,
                        url: playUrl,
                        quality: 'Auto',
                        provider: 'Lordflix',
                        headers: LORDFLIX_HEADERS
                    });
                }
            } catch {
                // Ignore server error
            }
        }));

        console.log(`[Lordflix] Total streams: ${streams.length}`);
        return streams;
    } catch (err) {
        console.error(`[Lordflix] Error: ${err.message}`);
        return [];
    }
}

module.exports = { getLordflixStreams };
