import { describe, it, expect } from 'vitest';
import { AUTO_SPERRE_MS, sollSperren } from './autoSperre';

describe('Auto-Sperre nach Hintergrund', () => {
  it('sperrt nicht, wenn die App nie im Hintergrund war', () => {
    expect(sollSperren(null)).toBe(false);
  });

  it('sperrt vor Ablauf der Frist nicht', () => {
    expect(sollSperren(1_000, 1_000 + AUTO_SPERRE_MS - 1)).toBe(false);
  });

  it('sperrt nach Ablauf der Frist', () => {
    expect(sollSperren(1_000, 1_000 + AUTO_SPERRE_MS)).toBe(true);
  });
});
