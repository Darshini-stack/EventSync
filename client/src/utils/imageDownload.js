import { getApiBaseUrl } from '../services/api';

/**
 * Sanitizes a title, query, or topic into a clean URL/filename slug.
 *
 * @param {string} text - Raw string
 * @param {string} [fallback='image'] - Fallback name
 * @returns {string} Sanitized string
 */
export const sanitizeFilename = (text = '', fallback = 'image') => {
  const clean = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || fallback;
};

/**
 * Generates a dynamic, meaningful filename for downloaded images.
 * Zero hardcoding: dynamically derived from actual title, query, prompt, or event context.
 *
 * Examples:
 * - Event Poster: eventsync-event-poster-dumb-charades.jpg
 * - Search Result: eventsync-image-eiffel-tower.jpg
 * - AI Generated: eventsync-generated-cyberpunk-cat.jpg
 *
 * @param {Object} params
 * @param {string} [params.eventTitle]
 * @param {string} [params.title]
 * @param {string} [params.query]
 * @param {string} [params.prompt]
 * @param {string} [params.imageType]
 * @param {string} [params.extension='jpg']
 * @returns {string} Dynamic filename
 */
export const getDynamicImageFilename = ({
  eventTitle,
  title,
  query,
  prompt,
  imageType = 'image',
  extension = 'jpg',
} = {}) => {
  if (eventTitle) {
    return `eventsync-event-poster-${sanitizeFilename(eventTitle, 'poster')}.${extension}`;
  }
  if (query) {
    return `eventsync-image-${sanitizeFilename(query, 'search')}.${extension}`;
  }
  if (title) {
    return `eventsync-image-${sanitizeFilename(title, 'photo')}.${extension}`;
  }
  if (prompt) {
    // Strip common prompt words for a concise filename
    const cleanPrompt = String(prompt)
      .replace(/^(?:create|generate|make|draw|high-quality|professional|artwork|poster)\s+(?:a|an|the|of|for)?\s*/i, '')
      .slice(0, 35);
    return `eventsync-generated-${sanitizeFilename(cleanPrompt, 'art')}.${extension}`;
  }
  return `eventsync-${sanitizeFilename(imageType, 'image')}-${Date.now()}.${extension}`;
};

/**
 * Robust image download function using Blobs and temporary object URLs.
 * 
 * Guarantees:
 * 1. Triggers real browser file download to user's disk/Downloads folder.
 * 2. Never merely opens in a new tab.
 * 3. Bypasses cross-origin <a download> restrictions via backend proxy when needed.
 * 4. Cleans up object URLs and temporary DOM nodes cleanly.
 *
 * @param {string} imageUrl - Direct or proxy URL of the image
 * @param {string} [filename='eventsync-image.jpg'] - Desired file name
 * @returns {Promise<boolean>} Resolves true on success, throws on failure
 */
export const downloadImageFile = async (imageUrl, filename = 'eventsync-image.jpg') => {
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('A valid image URL is required for download.');
  }

  // 1. Check if same-origin, data URL, or blob URL
  let isCrossOrigin = false;
  if (typeof window !== 'undefined' && imageUrl.startsWith('http')) {
    try {
      const parsed = new URL(imageUrl, window.location.origin);
      isCrossOrigin = parsed.origin !== window.location.origin;
    } catch (e) {
      isCrossOrigin = true;
    }
  }

  // 2. Build target fetch URL: use backend image proxy for cross-origin URLs
  const baseUrl = getApiBaseUrl();
  const safeFilename = filename || 'eventsync-download.jpg';

  const targetFetchUrl = isCrossOrigin
    ? `${baseUrl}/chat/image-proxy?url=${encodeURIComponent(imageUrl)}&download=true&filename=${encodeURIComponent(safeFilename)}`
    : imageUrl;

  // 3. Fetch image binary payload
  let res;
  try {
    res = await fetch(targetFetchUrl);
    if (!res.ok) {
      // Fallback attempt: if proxy returned an error, try direct fetch if CORS allows
      if (isCrossOrigin) {
        res = await fetch(imageUrl, { mode: 'cors' });
      }
    }
  } catch (fetchErr) {
    if (isCrossOrigin) {
      res = await fetch(imageUrl, { mode: 'cors' });
    } else {
      throw fetchErr;
    }
  }

  if (!res || !res.ok) {
    throw new Error(`Download failed with server status ${res ? res.status : 'Network Error'}`);
  }

  // 4. Convert response to Blob
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Received empty image payload.');
  }

  // 5. Generate Object URL and trigger real browser download
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = safeFilename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // 6. Cleanup DOM and release memory
  setTimeout(() => {
    try {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(blobUrl);
    } catch (cleanupErr) {
      // Ignore if already removed
    }
  }, 300);

  return true;
};
