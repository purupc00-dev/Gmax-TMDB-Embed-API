const axios = require('axios');
const cheerio = require('cheerio');

async function getSheguStreams(tmdbId, type, season = null, episode = null) {
  try {
    // 1. Build the correct URL based on if it's a movie or tv show
    const mediaType = type === 'movie' || type === 'movie' ? 'movie' : 'tv';
    const url = mediaType === 'movie' 
      ? `https://downloads.shegu.st/movie/${tmdbId}` 
      : `https://downloads.shegu.st/tv/${tmdbId}/${season}/${episode}`;

    console.log(`[Shegu] Fetching URL: ${url}`);

    // 2. Fetch the HTML page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 8000 
    });

    const $ = cheerio.load(response.data);
    const streams = [];

    // 3. Find all download links on the page
    // NOTE: You may need to inspect the Shegu HTML and adjust 'a.btn-download' to match their actual button class
    $('a.btn-download').each((index, element) => {
      const link = $(element).attr('href');
      const qualityText = $(element).text() || '1080p'; // Fallback to 1080p if text is empty
      
      if (link) {
        streams.push({
          name: `Shegu - ${qualityText}`,
          title: `Shegu Download`,
          url: link.startsWith('http') ? link : `https://downloads.shegu.st${link}`,
          quality: qualityText.includes('2160') ? '2160p' : qualityText.includes('720') ? '720p' : '1080p',
          provider: 'shegu',
          headers: {}
        });
      }
    });

    console.log(`[Shegu] Found ${streams.length} streams.`);
    return streams;

  } catch (error) {
    console.warn(`[Shegu] Scrape failed for ${tmdbId}: ${error.message}`);
    return []; 
  }
}

module.exports = { getSheguStreams };
