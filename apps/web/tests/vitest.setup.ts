import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      disconnect(): void {}
      observe(): void {}
      unobserve(): void {}
    },
  );

  Object.defineProperty(window.screen, 'orientation', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      angle: 0,
      removeEventListener: vi.fn(),
      type: 'landscape-primary',
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
