import { ipcMain } from 'electron';
import { readFileSync } from 'node:fs';
import modelPath from '../../resources/u2netp.onnx?asset';
import wasmPath from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?asset';

/** The background-removal model (U²-Net small, Apache-2.0) and the ONNX runtime's WebAssembly, read from the app files. */
export function registerAiIpc(): void {
  ipcMain.handle('ai:backgroundModel', () => ({
    model: new Uint8Array(readFileSync(modelPath)),
    wasm: new Uint8Array(readFileSync(wasmPath)),
  }));
}
