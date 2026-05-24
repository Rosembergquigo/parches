/**
 * Video Streaming Server
 *
 * Responsibilities:
 *  - Accepts RTMP push from OBS / encoder (port 1935)
 *  - Transcodes to HLS segments via ffmpeg
 *  - Serves HLS manifests & segments over HTTP
 *  - Manages stream keys tied to Match IDs
 *
 * NOTE: This server does NOT handle real-time score data.
 * All referee events go through @parches/streaming-data.
 *
 * Requires: ffmpeg installed on host
 */
import NodeMediaServer from 'node-media-server';
import Fastify from 'fastify';
import staticServe from '@fastify/static';
import { PORTS } from '@parches/config';
import path from 'node:path';

// ── RTMP + HLS Transcoding ───────────────────────────────────────
const nms = new NodeMediaServer({
  rtmp: { port: 1935, chunk_size: 60000, gop_cache: true, ping: 30, ping_timeout: 60 },
  http: {
    port: PORTS.STREAMING_VIDEO,
    allow_origin: '*',
    mediaroot: './media',
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
      },
    ],
  },
});

nms.run();

// ── HTTP API (stream session management) ─────────────────────────
const api = Fastify({ logger: true });

api.get('/stream/:streamKey/hls', async (request, reply) => {
  // Returns the HLS manifest URL for a given stream key
  const { streamKey } = request.params as { streamKey: string };
  return reply.send({
    hlsUrl: `http://localhost:${PORTS.STREAMING_VIDEO}/live/${streamKey}/index.m3u8`,
  });
});

api.listen({ port: 3003, host: '0.0.0.0' }); // Management API on separate port
