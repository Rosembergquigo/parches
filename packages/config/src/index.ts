export const PORTS = {
  WEB: 4321,
  API: 3000,
  STREAMING_DATA: 3001,
  STREAMING_VIDEO: 3002,
} as const;

export const ENDPOINTS = {
  API_HTTP: process.env.API_URL ?? `http://localhost:${PORTS.API}`,
  STREAMING_DATA_WS: process.env.STREAMING_DATA_WS_URL ?? `ws://localhost:${PORTS.STREAMING_DATA}`,
  STREAMING_DATA_HTTP: process.env.STREAMING_DATA_URL ?? `http://localhost:${PORTS.STREAMING_DATA}`,
  STREAMING_VIDEO_HTTP: process.env.STREAMING_VIDEO_URL ?? `http://localhost:${PORTS.STREAMING_VIDEO}`,
} as const;

export const SPORTS_CONFIG = {
  PERIODS: {
    football:   { count: 2, label: 'Half' },
    basketball: { count: 4, label: 'Quarter' },
    tennis:     { count: 5, label: 'Set' },
    volleyball: { count: 5, label: 'Set' },
    baseball:   { count: 9, label: 'Inning' },
    hockey:     { count: 3, label: 'Period' },
  },
} as const;
