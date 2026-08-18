const axios = require('axios');

const VIDLINK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://vidlink.pro/',
  'Origin': 'https://vidlink.pro'
};

async function getVidlinkStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
  console.log(`[Vidlink] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

  try {
    // Step 1: Hit enc-dec.app
    const encRes = await axios.get(
      `https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(String(tmdbId))}`,
      { timeout: 10000 }
    );
    
    const resData = encRes.data;
    const streams = [];

    // NEW BEHAVIOR: enc-dec.app directly returns the stream JSON payload
    if (resData && resData.stream) {
        console.log('[Vidlink] Received direct stream payload from enc-dec.app');
        const streamData = resData.stream;
        
        // Loop through the qualities (1080, 480, 360) and extract the direct .mp4 links
        if (streamData.qualities) {
            for (const [quality, src] of Object.entries(streamData.qualities)) {
                if (src && src.url) {
                    streams.push({
                        name: `Vidlink (${quality}p)`,
                        title: `Vidlink - ${quality}p`,
                        url: src.url,
                        quality: `${quality}p`,
                        provider: 'Vidlink',
                        headers: VIDLINK_HEADERS
                    });
                }
            }
        } 
        // Fallback if they return a single playlist instead of distinct qualities
        else if (streamData.playlist) {
            streams.push({
                name: 'Vidlink',
                title: 'Vidlink - Auto',
                url: streamData.playlist,
                quality: 'Auto',
                provider: 'Vidlink',
                headers: VIDLINK_HEADERS
            });
        }
        
        if (streams.length > 0) return streams;
    }

    // OLD BEHAVIOR FALLBACK: enc-dec.app returns an encrypted token string
    const encodedTmdb = resData?.result || resData?.text || (typeof resData === 'string' ? resData : null);
    
    if (!encodedTmdb || typeof encodedTmdb !== 'string') {
      console.log('[Vidlink] Could not resolve token or direct stream.');
      return [];
    }

    // Fetch stream playlist from Vidlink API using the token
    const type = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
    const apiUrl = type === 'tv'
      ? `https://vidlink.pro/api/b/tv/${encodedTmdb}/${seasonNum}/${episodeNum}?multiLang=0`
      : `https://vidlink.pro/api/b/movie/${encodedTmdb}?multiLang=0`;

    const apiRes = await axios.get(apiUrl, { headers: VIDLINK_HEADERS, timeout: 10000 });
    const playlist = apiRes.data?.stream?.playlist || apiRes.data?.playlist;

    if (!playlist) {
      console.log('[Vidlink] No playlist URL in Vidlink API response.');
      return [];
    }

    console.log('[Vidlink] Got stream successfully via token fallback.');
    return [{
      name: 'Vidlink',
      title: 'Vidlink - Auto',
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
