/**
 * VideoPlayer.tsx — React island para reproducción HLS.
 *
 * Usa hls.js para reproducir el stream HLS desde streaming-video.
 * hls.js se carga desde CDN en tiempo de ejecución (no en el bundle)
 * para evitar aumentar el peso del cliente.
 *
 * Si no hay hlsUrl (stream no disponible), muestra un placeholder
 * con el mensaje correcto según el estado del partido.
 *
 * En producción el hlsUrl vendría de:
 *   GET /stream/:streamKey/hls  → { hlsUrl: "http://.../live/key/index.m3u8" }
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  hlsUrl?: string;
  matchStatus: 'LIVE' | 'SCHEDULED' | 'FINISHED';
  homeTeam: string;
  awayTeam: string;
  streamKey?: string;
}

declare global {
  interface Window { Hls: any; }
}

export default function VideoPlayer({
  hlsUrl, matchStatus, homeTeam, awayTeam, streamKey,
}: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const hlsRef    = useRef<any>(null);
  const [ready,   setReady]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [muted,   setMuted]   = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;

    // Lazy-load hls.js from CDN
    function initHls() {
      const video = videoRef.current!;

      if (window.Hls?.isSupported()) {
        const hls = new window.Hls({
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl!);
        hls.attachMedia(video);
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          setReady(true);
          video.play().catch(() => { /* autoplay blocked — user must tap play */ });
        });
        hls.on(window.Hls.Events.ERROR, (_: any, data: any) => {
          if (data.fatal) setError('Error al cargar el stream');
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = hlsUrl!;
        video.addEventListener('loadedmetadata', () => setReady(true));
      } else {
        setError('Tu navegador no soporta streaming HLS');
      }
    }

    if (window.Hls) {
      initHls();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js';
      script.onload = initHls;
      script.onerror = () => setError('No se pudo cargar el reproductor');
      document.head.appendChild(script);
    }

    return () => {
      hlsRef.current?.destroy();
    };
  }, [hlsUrl]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  }

  function toggleMute() {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  }

  // ── No stream available ─────────────────────────────────
  if (!hlsUrl) {
    return (
      <div className="vp vp--placeholder">
        <div className="vp__placeholder-inner">
          {matchStatus === 'LIVE' && (
            <>
              <div className="vp__placeholder-icon">📡</div>
              <p className="vp__placeholder-title">Stream no disponible</p>
              <p className="vp__placeholder-sub">
                {streamKey
                  ? `Stream key: ${streamKey} · Esperando señal RTMP`
                  : 'El stream de este partido no está configurado'}
              </p>
            </>
          )}
          {matchStatus === 'SCHEDULED' && (
            <>
              <div className="vp__placeholder-icon">🕐</div>
              <p className="vp__placeholder-title">{homeTeam} vs {awayTeam}</p>
              <p className="vp__placeholder-sub">El stream comenzará cuando inicie el partido</p>
            </>
          )}
          {matchStatus === 'FINISHED' && (
            <>
              <div className="vp__placeholder-icon">🎬</div>
              <p className="vp__placeholder-title">Partido finalizado</p>
              <p className="vp__placeholder-sub">La grabación del partido estará disponible próximamente</p>
            </>
          )}
        </div>
        <PlaceholderStyles />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────
  if (error) {
    return (
      <div className="vp vp--error">
        <p className="vp__error-text">⚠ {error}</p>
        <PlaceholderStyles />
      </div>
    );
  }

  // ── Video player ────────────────────────────────────────
  return (
    <div className="vp vp--active">
      <video
        ref={videoRef}
        className="vp__video"
        muted={muted}
        playsInline
        autoPlay
        aria-label={`Stream en vivo: ${homeTeam} vs ${awayTeam}`}
      />

      {/* Overlay controls */}
      <div className="vp__controls">
        <button
          className="vp__ctrl-btn"
          onClick={togglePlay}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        <div className="vp__ctrl-center">
          {matchStatus === 'LIVE' && (
            <span className="vp__live-badge">
              <span className="vp__live-dot" aria-hidden="true" />
              EN VIVO
            </span>
          )}
        </div>

        <button
          className="vp__ctrl-btn"
          onClick={toggleMute}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {!ready && (
        <div className="vp__loading">
          <div className="vp__spinner" aria-label="Cargando stream" />
        </div>
      )}

      <style>{`
        .vp--active {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #000;
          border-radius: 10px;
          overflow: hidden;
        }
        .vp__video {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }
        .vp__controls {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .vp--active:hover .vp__controls { opacity: 1; }
        .vp__ctrl-btn {
          background: none; border: none;
          font-size: 1.1rem; cursor: pointer;
          padding: 4px; border-radius: 4px;
          transition: background 0.15s;
        }
        .vp__ctrl-btn:hover { background: rgba(255,255,255,0.15); }
        .vp__ctrl-center { flex: 1; display: flex; justify-content: center; }
        .vp__live-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 8px;
          background: rgba(255,59,59,0.85);
          border-radius: 3px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.62rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #fff;
        }
        .vp__live-dot {
          width: 5px; height: 5px;
          background: #fff; border-radius: 50%;
          animation: ldPulse 1.2s ease-in-out infinite;
        }
        @keyframes ldPulse {
          0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.65)}
        }
        .vp__loading {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.5);
        }
        .vp__spinner {
          width: 36px; height: 36px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: #00e5ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .vp--error {
          width: 100%; aspect-ratio: 16/9;
          background: #111418;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .vp__error-text {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 0.85rem; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: #ff3b3b;
        }
      `}</style>
    </div>
  );
}

function PlaceholderStyles() {
  return (
    <style>{`
      .vp--placeholder, .vp--error {
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #111418;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .vp__placeholder-inner {
        text-align: center;
        padding: 24px;
      }
      .vp__placeholder-icon {
        font-size: 2.5rem;
        margin-bottom: 12px;
        opacity: 0.5;
      }
      .vp__placeholder-title {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #f0f2f5;
        margin-bottom: 6px;
      }
      .vp__placeholder-sub {
        font-family: 'Barlow', sans-serif;
        font-size: 0.82rem;
        color: #8a9099;
        line-height: 1.4;
      }
    `}</style>
  );
}