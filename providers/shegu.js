const axios = require('axios');
const cheerio = require('cheerio');

// The backend registry.js automatically passes the tmdbId, 'movie' or 'tv', and the season/episode!
async function getSheguStreams(tmdbId, mediaType, season = null, episode = null) {
  try {
    // 1. Build the exact Shegu URL based on the variables provided by registry.js
    const url = mediaType === 'movie' 
      ? `https://downloads.shegu.st/movie/${tmdbId}` 
      : `https://downloads.shegu.st/tv/${tmdbId}/${season}/${episode}`;

    console.log(`[Shegu] Fetching URL: ${url}`);

    // 2. Fetch the HTML page from Shegu
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 8000 
    });

    const $ = cheerio.load(response.data);
    const streams = [];

    // 3. Find the download links on the page
    // We look for any 'a' (link) tag that contains a video file extension
    $('a').each((index, element) => {
      const link = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      
      if (link && (link.includes('.m3u8') || link.includes('.mp4') || link.includes('.mkv'))) {
        // Guess the quality based on the button text, default to 1080p
        const qualityText = text.includes('2160') ? '2160p' : text.includes('720') ? '720p' : '1080p';
        
        streams.push({
          name: `Shegu - ${qualityText}`,
          title: `Shegu Download`,
          url: link.startsWith('http') ? link : `https://downloads.shegu.st${link}`,
          quality: qualityText,
          provider: 'shegu',
          headers: {}
        });
      }
    });

    console.log(`[Shegu] Found ${streams.length} streams.`);
    return streams;

  } catch (error) {
    // If the page doesn't exist or rate-limits you, it safely fails without crashing the API
    console.warn(`[Shegu] Scrape failed for ${tmdbId}: ${error.message}`);
    return []; 
  }
}

module.exports = { getSheguStreams };
