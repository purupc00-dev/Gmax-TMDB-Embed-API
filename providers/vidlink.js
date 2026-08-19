const axios = require('axios');
const crypto = require('crypto'); // Required for Hexa's X-Api-Key

const PROXY_URL = 'https://gmax-stream-proxy.gmaxstudioes.workers.dev/';

function proxyStreamUrl(streamUrl) {
  if (!streamUrl) return streamUrl;
  return `${PROXY_URL}?url=${encodeURIComponent(streamUrl)}`;
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const num = parseInt(bytes, 10);
  if (num === 0) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function getHexaStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
  console.log(`[Hexa] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

  try {
    const isTv = mediaType === 'tv' || mediaType === 'series';

    // Step 1: Generate a 32-byte hex key for Hexa's required headers
    const apiKey = crypto.randomBytes(32).toString('hex');

    // Step 2: Query enc-dec.app for the Hexa challenge token
    const encRes = await axios.get('https://enc-dec.app/api/enc-hexa', { timeout: 10000 });
    
    if (encRes.data?.status !== 200 || !encRes.data?.result?.token) {
      throw new Error('Failed to fetch challenge token from enc-dec.app');
    }
    
    const token = encRes.data.result.token;

    // Step 3: Set up Hexa API headers
    const hexaHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Referer': 'https://hexa.su/',
      'Accept': 'text/plain',
      'X-Fingerprint-Lite': 'e9136c41504646444',
      'X-Api-Key': apiKey,
      'X-Cap-Token': token
    };

    // Step 4: Build target URL and fetch encrypted stream data from Hexa
    const targetUrl = isTv 
      ? `https://theemoviedb.hexa.su/api/tmdb/tv/${tmdbId}/season/${seasonNum}/episode/${episodeNum}/images`
      : `https://theemoviedb.hexa.su/api/tmdb/movie/${tmdbId}/images`;

    const hexaRes = await axios.get(targetUrl, { 
      headers: hexaHeaders, 
      timeout: 10000,
      responseType: 'text' // Hexa returns raw encrypted text
    });

    const encryptedText = hexaRes.data;
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error('Invalid encrypted payload received from Hexa');
    }

    // Step 5: Decrypt the text via enc-dec.app
    const decRes = await axios.post('https://enc-dec.app/api/dec-hexa', {
      text: encryptedText,
      key: apiKey
    }, { timeout: 10000 });

    if (decRes.data?.status !== 200 || !decRes.data?.result) {
      throw new Error('Failed to decrypt Hexa payload');
    }

    const decryptedData = decRes.data.result;
    const streams = [];

    // Step 6: Parse the decrypted streams based on enc-dec's typical structure formats
    
    // Format A: { qualities: { "1080": { url, size } } }
    if (decryptedData.qualities && typeof decryptedData.qualities === 'object') {
      for (const [qualityKey, mediaObj] of Object.entries(decryptedData.qualities)) {
        if (mediaObj && mediaObj.url) {
          const qualityLabel = `${qualityKey}p`;
          const sizeStr = formatBytes(mediaObj.size);

          streams.push({
            name: `Hexa (${qualityLabel})`,
            title: `Hexa - ${qualityLabel}${sizeStr ? ` [${sizeStr}]` : ''}`,
            url: proxyStreamUrl(mediaObj.url),
            quality: qualityLabel,
            size: sizeStr,
            provider: 'Hexa'
          });
        }
      }
    } 
    // Format B: { sources: [ { url, quality, size } ] }
    else if (Array.isArray(decryptedData.sources)) {
      decryptedData.sources.forEach(src => {
        if (src.url) {
          const q = src.quality || 'Auto';
          const sizeStr = formatBytes(src.size);
          
          streams.push({
            name: `Hexa (${q})`,
            title: `Hexa - ${q}${sizeStr ? ` [${sizeStr}]` : ''}`,
            url: proxyStreamUrl(src.url),
            quality: q,
            size: sizeStr,
            provider: 'Hexa'
          });
        }
      });
    } 
    // Format C: Flat playlist fallback
    else if (decryptedData.playlist || decryptedData.url) {
      const playlistUrl = decryptedData.playlist || decryptedData.url;
      streams.push({
        name: 'Hexa',
        title: 'Hexa - Auto',
        url: proxyStreamUrl(playlistUrl),
        quality: 'Auto',
        provider: 'Hexa'
      });
    }

    console.log(`[Hexa] Total streams resolved: ${streams.length}`);
    return streams;

  } catch (err) {
    console.error(`[Hexa] Error: ${err.message}`);
    return [];
  }
}

module.exports = { getHexaStreams };
