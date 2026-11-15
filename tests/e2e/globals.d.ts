import type { LmuApi } from '../../src/shared/types';

declare global {
  interface Window {
    lmu: LmuApi;
    // test hook exposed by the renderer when LIVERY_TEST=1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __livery: any;
  }
}
