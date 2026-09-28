/**
 * wikipediaService.js
 * Fetches verified Wikipedia images for invention cards using the official Wikipedia REST API.
 * Never trusts or relies on LLM-supplied image URLs.
 */

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

/**
 * Fetches summary and thumbnail image for a given person / entity from English Wikipedia.
 * @param {string} wikipediaTitle - Exact English Wikipedia title (e.g. "Alexander_Graham_Bell", "Thomas_Edison")
 * @returns {Promise<string>} Image URL or fallback avatar
 */
const fetchPersonThumbnail = async (wikipediaTitle) => {
  if (!wikipediaTitle || typeof wikipediaTitle !== 'string') {
    return DEFAULT_AVATAR;
  }

  try {
    const formattedTitle = encodeURIComponent(wikipediaTitle.trim().replace(/\s+/g, '_'));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${formattedTitle}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'EventSync/1.0 (college-eventsync@vits.ac.in)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return DEFAULT_AVATAR;
    }

    const data = await response.json();
    if (data && data.thumbnail && data.thumbnail.source) {
      return data.thumbnail.source;
    }

    if (data && data.originalimage && data.originalimage.source) {
      return data.originalimage.source;
    }

    return DEFAULT_AVATAR;
  } catch (err) {
    console.warn(`[WikipediaService] Failed to fetch thumbnail for "${wikipediaTitle}":`, err.message);
    return DEFAULT_AVATAR;
  }
};

module.exports = { fetchPersonThumbnail, DEFAULT_AVATAR };
