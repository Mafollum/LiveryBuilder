import { statSync } from 'node:fs';
import { basename } from 'node:path';
import createPanelWorker from './panelWorker?nodeWorker';
import type { PanelData } from '../../shared/types';
import { cacheKey, readCachedPanel, writeCachedPanel } from './panelCache';

function runWorker(path: string): Promise<PanelData> {
  return new Promise((resolve, reject) => {
    const worker = createPanelWorker({ workerData: { path } });
    worker.once('message', (msg: { ok: true; data: PanelData } | { ok: false; message: string }) => {
      void worker.terminate();
      if (msg.ok) resolve({ ...msg.data, panel: new Uint8Array(msg.data.panel) });
      else reject(new Error(msg.message));
    });
    worker.once('error', reject);
  });
}

/** Panel data for a template file: from the cache when the file is unchanged, else computed in a worker. */
export async function openTemplateAt(path: string, userData: string): Promise<PanelData> {
  const st = statSync(path);
  const key = cacheKey({ fileName: basename(path), sizeBytes: st.size, mtimeMs: Math.floor(st.mtimeMs) });
  const cached = readCachedPanel(userData, key);
  if (cached) return cached;
  const data = await runWorker(path);
  try {
    writeCachedPanel(userData, key, data);
  } catch {
    // cache is an optimisation only
  }
  return data;
}
