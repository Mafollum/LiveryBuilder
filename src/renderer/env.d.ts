export {};
declare global {
  interface Window {
    lmu: { ready(): void };
  }
}
