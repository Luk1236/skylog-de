import { describe, it, expect } from 'vitest';
import { calculateInitialGrc, calculateInitialArc, determineSail, evaluateSora } from './sora25';

describe('sora25 service', () => {
  it('calculates initial GRC based on environment and drone MTOM', () => {
    expect(calculateInitialGrc('controlled', 0.9)).toBe(1);
    expect(calculateInitialGrc('sparse', 2.0)).toBe(3);
    expect(calculateInitialGrc('populated', 3.5)).toBe(5);
    expect(calculateInitialGrc('assembly', 5.0)).toBe(8);
  });

  it('calculates initial ARC correctly', () => {
    expect(calculateInitialArc('uncontrolled', 100)).toBe('ARC-b');
    expect(calculateInitialArc('uncontrolled', 150)).toBe('ARC-c');
    expect(calculateInitialArc('controlled', 100)).toBe('ARC-c');
    expect(calculateInitialArc('airport', 50)).toBe('ARC-d');
  });

  it('determines SAIL levels correctly', () => {
    expect(determineSail(1, 'ARC-a')).toBe('SAIL I');
    expect(determineSail(3, 'ARC-b')).toBe('SAIL II');
    expect(determineSail(4, 'ARC-c')).toBe('SAIL III');
  });

  it('evaluates complete SORA input with mitigations', () => {
    const res = evaluateSora({
      operationTitle: 'Test Flight',
      environment: 'sparse',
      visibility: 'vlos',
      airspace: 'uncontrolled',
      maxAltitudeM: 100,
      droneMtomKg: 2.0,
      m1Mitigation: true,
      m2Mitigation: true,
      m3Mitigation: false,
    });

    expect(res.initialGrc).toBe(3);
    expect(res.finalGrc).toBe(1); // 3 - 2 = 1
    expect(res.initialArc).toBe('ARC-b');
    expect(res.sail).toBe('SAIL II');
    expect(res.requiredOsos.length).toBeGreaterThan(0);
  });
});
