const axios = require('axios');
const cheerio = require('cheerio');

async function getSheguStreams(tmdbId, mediaType, season = null, episode = null) {
  try {
    // 1. Normalize mediaType ('series' -> 'tv')
    const type = mediaType === 'series' || mediaType === 'tv' ? 'tv' : 'movie';
    const url = type === 'movie' 
      ? `https://downloads.shegu.st/movie/${tmdbId}` 
      : `https://downloads.shegu.st/tv/${tmdbId}/${season}/${episode}`;

    console.log(`[Shegu] Fetching URL: ${url}`);

    // 2. Fetch the HTML page from Shegu
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000 
    });

    const $ = cheerio.load(response.data);
    const streams = [];

    // 3. Find the download links on the page using Cheerio (original working logic)
    $('a').each((index, element) => {
      const link = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      
      if (link && (link.includes('.m3u8') || link.includes('.mp4') || link.includes('.mkv'))) {
        // Guess the quality based on the button text
        const qualityText = text.includes('2160') ? '2160p' : text.includes('720') ? '720p' : '1080p';
        
        // Grab the actual text from the link for the title
        const originalText = $(element).text().trim() || '4K CINEJOY Download';
        
        streams.push({
          name: `4K CINEJOY (${qualityText})`,
          title: originalText,
          url: link.startsWith('http') ? link : `https://downloads.shegu.st${link}`,
          quality: qualityText,
          // Changing provider groups it under a "4K CINEJOY" box in your frontend
          provider: '4K CINEJOY', 
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
