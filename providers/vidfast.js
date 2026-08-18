const axios = require('axios');

const VIDFAST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://vidfast.vc/',
  'Origin': 'https://vidfast.vc'
};

async function getVidfastStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
  try {
    const type = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
    const queryText = type === 'tv'
      ? `tv/${tmdbId}/${seasonNum}/${episodeNum}`
      : `movie/${tmdbId}`;

    console.log(`[Vidfast] Requesting token for ${queryText}`);

    // Step 1: Encrypt request token via enc-dec.app
    const encRes = await axios.get(
      `https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(queryText)}`,
      { timeout: 8000 }
    );

    const encToken = encRes.data?.result || encRes.data?.text || encRes.data;
    if (!encToken || typeof encToken !== 'string') {
      console.log('[Vidfast] Failed to acquire encrypted token');
      return [];
    }

    // Step 2: Request encrypted payload from Vidfast
    const vidfastRes = await axios.get(
      `https://vidfast.vc/api/stream/${encToken}`,
      { headers: VIDFAST_HEADERS, timeout: 8000, responseType: 'text' }
    );

    const rawEncryptedData = typeof vidfastRes.data === 'string' ? vidfastRes.data : JSON.stringify(vidfastRes.data);
    if (!rawEncryptedData || rawEncryptedData.startsWith('<')) {
      console.log('[Vidfast] Invalid response payload from upstream');
      return [];
    }

    // Step 3: Decrypt payload via enc-dec.app
    const decRes = await axios.post(
      'https://enc-dec.app/api/dec-vidfast',
      { text: rawEncryptedData },
      { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
    );

    const resData = decRes.data?.result || decRes.data;
    const streams = [];

    if (resData && Array.isArray(resData.sources)) {
      for (const s of resData.sources) {
        if (!s.url) continue;
        streams.push({
          name: `Vidfast - ${s.quality || 'Auto'}`,
          title: `Vidfast - ${s.quality || 'Auto'}`,
          url: s.url,
          quality: s.quality || 'Auto',
          provider: 'vidfast',
          headers: VIDFAST_HEADERS
        });
      }
    } else if (resData && (resData.url || resData.file)) {
      streams.push({
        name: 'Vidfast',
        title: 'Vidfast - Auto',
        url: resData.url || resData.file,
        quality: 'Auto',
        provider: 'vidfast',
        headers: VIDFAST_HEADERS
      });
    }

    console.log(`[Vidfast] Found ${streams.length} stream(s)`);
    return streams;
  } catch (err) {
    console.error(`[Vidfast] Error: ${err.message}`);
    return [];
  }
}

module.exports = { getVidfastStreams };
