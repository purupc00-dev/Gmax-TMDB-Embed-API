const axios = require('axios');

async function getSheguStreams(tmdbId, mediaType, season = null, episode = null) {
  try {
    // 1. Normalize mediaType ('series' -> 'tv')
    const type = mediaType === 'series' || mediaType === 'tv' ? 'tv' : 'movie';
    const url = type === 'movie' 
      ? `https://downloads.shegu.st/movie/${tmdbId}` 
      : `https://downloads.shegu.st/tv/${tmdbId}/${season}/${episode}`;

    console.log(`[4K Cinejoy] Fetching JSON API: ${url}`);

    // 2. Fetch the JSON directly from the endpoint
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 10000 
    });

    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    
    if (!data || !Array.isArray(data.links)) {
      console.log('[4K Cinejoy] No links array found in JSON response.');
      return [];
    }

    // 3. Map the JSON links into your backend's unified stream format
    const streams = data.links
      .filter(item => item && item.url)
      .map(item => {
        const sourceName = item.source || '4K CINEJOY';
        const qualityVal = item.quality ? `${item.quality}p` : '1080p';

        return {
          name: `${sourceName} (${qualityVal})`,
          title: item.name || `${sourceName} Download`,
          url: item.url,
          quality: qualityVal,
          size: item.size || '',
          provider: '4K CINEJOY', 
          headers: {}
        };
      });

    console.log(`[4K Cinejoy] Successfully processed ${streams.length} stream(s)`);
    return streams;

  } catch (error) {
    console.warn(`[4K Cinejoy] Request failed for ${tmdbId}: ${error.message}`);
    return []; 
  }
}

module.exports = { getSheguStreams };
