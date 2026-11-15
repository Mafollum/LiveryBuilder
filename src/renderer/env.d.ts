import type { LmuApi } from '@shared/types';

declare global {
  interface Window {
    lmu: LmuApi;
  }
}
