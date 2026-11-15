import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { extractPanelData } from './panelMap';

const { path } = workerData as { path: string };
try {
  const data = extractPanelData(new Uint8Array(readFileSync(path)));
  parentPort!.postMessage({ ok: true, data }, [data.panel.buffer as ArrayBuffer]);
} catch (e) {
  parentPort!.postMessage({ ok: false, message: e instanceof Error ? e.message : String(e) });
}
