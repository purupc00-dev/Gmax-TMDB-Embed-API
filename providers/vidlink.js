const axios = require('axios');

const VIDLINK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://vidlink.pro/',
  'Origin': 'https://vidlink.pro'
};

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const num = parseInt(bytes, 10);
  if (num === 0) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function getVidlinkStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
  console.log(`[Vidlink] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

  try {
    const type = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
    const queryParam = type === 'tv' ? `${tmdbId}/${seasonNum}/${episodeNum}` : String(tmdbId);

    // Step 1: Query enc-dec.app
    const encRes = await axios.get(
      `https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(queryParam)}`,
      { timeout: 10000 }
    );

    const resData = encRes.data;
    const streams = [];

    // Format A: Direct Stream JSON Payload with qualities (1080, 480, 360)
    if (resData && resData.stream) {
      const streamData = resData.stream;

      if (streamData.qualities && typeof streamData.qualities === 'object') {
        for (const [qualityKey, mediaObj] of Object.entries(streamData.qualities)) {
          if (mediaObj && mediaObj.url) {
            const qualityLabel = `${qualityKey}p`;
            const sizeStr = formatBytes(mediaObj.size);

            streams.push({
              name: `Vidlink (${qualityLabel})`,
              title: `Vidlink - ${qualityLabel}${sizeStr ? ` [${sizeStr}]` : ''}`,
              url: mediaObj.url,
              quality: qualityLabel,
              size: sizeStr,
              provider: 'Vidlink',
              headers: VIDLINK_HEADERS
            });
          }
        }
      } else if (streamData.playlist) {
        streams.push({
          name: 'Vidlink',
          title: 'Vidlink - Auto',
          url: streamData.playlist,
          quality: 'Auto',
          provider: 'Vidlink',
          headers: VIDLINK_HEADERS
        });
      }

      if (streams.length > 0) {
        console.log(`[Vidlink] Successfully extracted ${streams.length} stream(s).`);
        return streams;
      }
    }

    // Format B: Token fallback if enc-dec.app returns an encrypted string
    const encodedTmdb = resData?.result || resData?.text || (typeof resData === 'string' ? resData : null);

    if (encodedTmdb && typeof encodedTmdb === 'string') {
      const apiUrl = type === 'tv'
        ? `https://vidlink.pro/api/b/tv/${encodedTmdb}/${seasonNum}/${episodeNum}?multiLang=0`
        : `https://vidlink.pro/api/b/movie/${encodedTmdb}?multiLang=0`;

      const apiRes = await axios.get(apiUrl, { headers: VIDLINK_HEADERS, timeout: 10000 });
      const streamObj = apiRes.data?.stream;

      if (streamObj?.qualities) {
        for (const [qualityKey, mediaObj] of Object.entries(streamObj.qualities)) {
          if (mediaObj && mediaObj.url) {
            const qualityLabel = `${qualityKey}p`;
            const sizeStr = formatBytes(mediaObj.size);

            streams.push({
              name: `Vidlink (${qualityLabel})`,
              title: `Vidlink - ${qualityLabel}${sizeStr ? ` [${sizeStr}]` : ''}`,
              url: mediaObj.url,
              quality: qualityLabel,
              size: sizeStr,
              provider: 'Vidlink',
              headers: VIDLINK_HEADERS
            });
          }
        }
      } else if (streamObj?.playlist || apiRes.data?.playlist) {
        streams.push({
          name: 'Vidlink',
          title: 'Vidlink - Auto',
          url: streamObj?.playlist || apiRes.data?.playlist,
          quality: 'Auto',
          provider: 'Vidlink',
          headers: VIDLINK_HEADERS
        });
      }
    }

    console.log(`[Vidlink] Total streams resolved: ${streams.length}`);
    return streams;

  } catch (err) {
    console.error(`[Vidlink] Error: ${err.message}`);
    return [];
  }
}

module.exports = { getVidlinkStreams };
