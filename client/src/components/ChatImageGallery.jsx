import React, { useState } from 'react';
import {
  ExternalLink,
  Download,
  Maximize2,
  X,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  Check,
  Sparkles,
} from 'lucide-react';
import { getApiBaseUrl } from '../services/api';
import { downloadImageFile, getDynamicImageFilename } from '../utils/imageDownload';

/**
 * Single Image Item inside the Gallery
 * Implements automatic backend proxy fallback, progressive loading skeleton, and error isolation.
 */
const GalleryImageItem = ({ item, onSelectForZoom }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [triedProxy, setTriedProxy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const initialSrc = item.thumbnailUrl || item.url;
  const proxyUrl = item.url && item.url.startsWith('https://')
    ? `${getApiBaseUrl()}/chat/image-proxy?url=${encodeURIComponent(item.url)}`
    : null;

  const [currentSrc, setCurrentSrc] = useState(initialSrc);

  const handleImageError = () => {
    if (!triedProxy && proxyUrl && proxyUrl !== currentSrc) {
      setTriedProxy(true);
      setCurrentSrc(proxyUrl);
    } else {
      setError(true);
      setLoaded(true);
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    setDownloadSuccess(false);

    const filename = getDynamicImageFilename({
      title: item.title,
      query: item.query,
      imageType: 'search-result',
      extension: 'jpg',
    });

    try {
      await downloadImageFile(item.url || currentSrc, filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('[ChatImageGallery] Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <div
        style={{
          borderRadius: '0.75rem',
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          minHeight: '140px',
          color: '#94A3B8',
          textAlign: 'center',
          fontSize: '0.78rem',
        }}
      >
        <ImageIcon size={24} style={{ opacity: 0.6 }} />
        <span>{item.title || 'Image unavailable'}</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelectForZoom(item, currentSrc)}
      style={{
        position: 'relative',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
        cursor: 'pointer',
        aspectRatio: '16 / 10',
        minHeight: '130px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
      }}
    >
      {/* Loading Skeleton */}
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.6) 0%, rgba(51, 65, 85, 0.6) 50%, rgba(30, 41, 59, 0.6) 100%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton 1.5s infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818CF8',
            zIndex: 1,
          }}
        >
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {/* Image */}
      <img
        src={currentSrc}
        alt={item.title || 'Search result image'}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={handleImageError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: loaded ? 'block' : 'none',
          transition: 'transform 0.3s ease',
        }}
      />

      {/* Gradient Overlay with Title and Actions on Hover */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.85) 100%)',
          padding: '0.65rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={handleDownload}
            title="Download image"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: downloadSuccess ? 'rgba(16, 185, 129, 0.85)' : 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            {downloadSuccess ? <Check size={12} /> : <Download size={12} />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectForZoom(item, currentSrc);
            }}
            title="Expand image"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Maximize2 size={12} />
          </button>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: '600',
              color: '#F8FAFC',
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.title}
          </div>
          {item.source && (
            <div
              style={{
                fontSize: '0.68rem',
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span>{item.source}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * ChatImageGallery
 * Renders multiple authentic image search results inside the chat stream.
 */
export const ChatImageGallery = ({ card }) => {
  const [zoomItem, setZoomItem] = useState(null);
  const [zoomSrc, setZoomSrc] = useState(null);

  const [modalDownloading, setModalDownloading] = useState(false);
  const [modalDownloadSuccess, setModalDownloadSuccess] = useState(false);

  const { query, text, images = [], message } = card || {};

  const handleSelectForZoom = (item, activeSrc) => {
    setZoomItem(item);
    setZoomSrc(activeSrc || item.url);
    setModalDownloadSuccess(false);
  };

  const handleCloseZoom = () => {
    setZoomItem(null);
    setZoomSrc(null);
    setModalDownloading(false);
    setModalDownloadSuccess(false);
  };

  const handleModalDownload = async (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (!zoomItem || modalDownloading) return;
    setModalDownloading(true);
    setModalDownloadSuccess(false);

    const filename = getDynamicImageFilename({
      title: zoomItem.title,
      query: zoomItem.query || query,
      imageType: 'search-result',
      extension: 'jpg',
    });

    try {
      await downloadImageFile(zoomSrc || zoomItem.url, filename);
      setModalDownloadSuccess(true);
      setTimeout(() => setModalDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('[ChatImageGallery Modal] Download failed:', err);
    } finally {
      setModalDownloading(false);
    }
  };

  if (!images || images.length === 0) {
    return (
      <div style={{ color: '#E2E8F0', fontSize: '0.88rem' }}>
        {text || message || `No images found for "${query}".`}
      </div>
    );
  }

  const isSingle = images.length === 1;

  return (
    <div
      className="chat-image-gallery"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: '100%',
        marginTop: '0.25rem',
      }}
    >
      {/* Lead Text / Factual Summary */}
      {(text || message) && (
        <div style={{ fontSize: '0.88rem', color: '#E2E8F0', lineHeight: 1.55 }}>
          {text || message}
        </div>
      )}

      {/* Grid of Results */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isSingle ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '0.65rem',
          width: '100%',
        }}
      >
        {images.map((item, idx) => (
          <GalleryImageItem
            key={`${item.url}-${idx}`}
            item={item}
            onSelectForZoom={handleSelectForZoom}
          />
        ))}
      </div>

      {/* Source Attribution Footer */}
      {images[0]?.source && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: '#94A3B8',
            paddingTop: '0.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Sparkles size={11} style={{ color: '#818CF8' }} />
            <span>Images from {images[0].source}</span>
          </div>
          {images[0]?.sourceUrl && (
            <a
              href={images[0].sourceUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#818CF8',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span>View Source</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {zoomItem && zoomSrc && (
        <div
          onClick={handleCloseZoom}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '1.25rem',
            cursor: 'zoom-out',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              borderRadius: '1rem',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              background: '#0F172A',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'default',
            }}
          >
            {/* Modal Top Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(15, 23, 42, 0.95)',
              }}
            >
              <div style={{ color: '#FFFFFF', fontWeight: '600', fontSize: '0.9rem' }}>
                {zoomItem.title}
              </div>
              <button
                type="button"
                onClick={handleCloseZoom}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#CBD5E1',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Image Display */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                maxHeight: 'calc(80vh - 80px)',
                background: '#090D16',
              }}
            >
              <img
                src={zoomSrc}
                alt={zoomItem.title || 'Full resolution preview'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>

            {/* Modal Footer Controls */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(15, 23, 42, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                {zoomItem.source && <span>Source: {zoomItem.source}</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {zoomItem.sourceUrl && (
                  <a
                    href={zoomItem.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: 'none',
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '0.45rem',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#CBD5E1',
                        fontSize: '0.76rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>Open Source Page</span>
                    </button>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleModalDownload}
                  disabled={modalDownloading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.45rem',
                    background: modalDownloadSuccess
                      ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
                      : 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '0.76rem',
                    fontWeight: '600',
                    cursor: modalDownloading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                  title="Download image"
                >
                  {modalDownloading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Downloading...</span>
                    </>
                  ) : modalDownloadSuccess ? (
                    <>
                      <Check size={12} />
                      <span>Downloaded!</span>
                    </>
                  ) : (
                    <>
                      <Download size={12} />
                      <span>Download Image</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
