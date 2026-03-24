import { useState, useEffect } from 'react';

interface VersionInfo {
  version: string;
  releaseDate: string;
  downloadUrl: string;
}

// Fallback values (updated manually as safety net)
const FALLBACK: VersionInfo = {
  version: '5.2.6',
  releaseDate: '2026-03-24',
  downloadUrl: 'http://a2g.samsungds.net:13000/nexus-coder-for-windows/Nexus%20Bot%20(For%20Windows)-Setup-5.2.6.exe',
};

// Module-level cache — shared across all hook instances, survives re-renders
let cachedResult: VersionInfo | null = null;
let fetchPromise: Promise<VersionInfo> | null = null;

async function fetchVersion(): Promise<VersionInfo> {
  try {
    const res = await fetch('/api/versions/latest');
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return {
      version: data.version,
      releaseDate: data.releaseDate,
      downloadUrl: data.electron?.downloadUrl || FALLBACK.downloadUrl,
    };
  } catch {
    return FALLBACK;
  }
}

export function useLatestVersion(): VersionInfo & { loading: boolean } {
  const [info, setInfo] = useState<VersionInfo>(cachedResult || FALLBACK);
  const [loading, setLoading] = useState(!cachedResult);

  useEffect(() => {
    if (cachedResult) {
      setInfo(cachedResult);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchVersion();
    }

    fetchPromise.then((result) => {
      cachedResult = result;
      setInfo(result);
      setLoading(false);
    });
  }, []);

  return { ...info, loading };
}
