/**
 * Version Routes
 *
 * MinIO에서 최신 CLI/Electron 버전 정보를 가져와 docs-site에 제공
 * - GET /versions/latest: 최신 버전 + 다운로드 링크
 */

import { Router } from 'express';

export const versionRoutes = Router();

const MINIO_BASE = process.env['MINIO_URL'] || 'http://a2g.samsungds.net:13000';
const CLI_LATEST_URL = `${MINIO_BASE}/nexus-coder/cli/latest.json`;
const ELECTRON_BUCKET = `${MINIO_BASE}/nexus-coder-for-windows`;

// In-memory cache (5 min TTL)
let cache: { data: Record<string, unknown>; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

versionRoutes.get('/latest', async (_req, res) => {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return res.json(cache.data);
    }

    const response = await fetch(CLI_LATEST_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`MinIO returned ${response.status}`);

    const cliData = await response.json() as { version: string; binaryUrl: string; releaseDate: string };
    const version = cliData.version;

    const result = {
      version,
      releaseDate: cliData.releaseDate,
      cli: {
        version,
        binaryUrl: cliData.binaryUrl,
      },
      electron: {
        version,
        downloadUrl: `${ELECTRON_BUCKET}/Nexus%20Bot%20(For%20Windows)-Setup-${version}.exe`,
      },
    };

    cache = { data: result, timestamp: Date.now() };
    res.json(result);
  } catch (error) {
    console.error('[Versions] Failed to fetch from MinIO:', error);
    if (cache) {
      return res.json(cache.data);
    }
    res.status(502).json({ error: 'Failed to fetch version info' });
  }
});
