const axios = require('axios');

async function getSheguStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
  try {
    // 1. Normalize mediaType ('series' -> 'tv')
    const type = mediaType === 'series' || mediaType === 'tv' ? 'tv' : 'movie';
    const url = type === 'movie' 
      ? `https://downloads.shegu.st/movie/${tmdbId}` 
      : `https://downloads.shegu.st/tv/${tmdbId}/${season}/${episode}`;

    console.log(`[Shegu] Fetching JSON API: ${url}`);

    // 2. Fetch the JSON directly from Shegu
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 10000 
    });

    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    
    if (!data || !Array.isArray(data.links)) {
      console.log('[Shegu] No links array found in JSON response.');
      return [];
    }

    // 3. Map Shegu's links into your backend's unified stream format
    const streams = data.links
      .filter(item => item && item.url)
      .map(item => ({
        name: `Shegu - ${item.source || 'Cinejoy'} (${item.quality || 'Auto'}p)`,
        title: item.name || `Shegu Download - ${item.quality || 'Auto'}p`,
        url: item.url,
        quality: item.quality ? `${item.quality}p` : '1080p',
        size: item.size || '',
        provider: 'shegu',
        headers: {}
      }));

    console.log(`[Shegu] Successfully processed ${streams.length} stream(s)`);
    return streams;

  } catch (error) {
    console.error(`[Shegu] Request failed for ${tmdbId}: ${error.message}`);
    return [];
  }
}

module.exports = { getSheguStreams };
