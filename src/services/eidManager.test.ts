import { describe, it, expect } from 'vitest';
import { validateEID, getPublicEID, buildAuthorityInspectionText, AUTHORITY_PORTALS } from './eidManager';

describe('eidManager', () => {
  it('validates valid e-IDs correctly', () => {
    const res1 = validateEID('DEU123456789012');
    expect(res1.isValid).toBe(true);
    expect(res1.formatted).toBe('DEU123456789012');

    const res2 = validateEID('deu87ast46rac38a-xyz');
    expect(res2.isValid).toBe(true);
    expect(res2.formatted).toBe('DEU87AST46RAC38A-XYZ');
  });

  it('rejects invalid e-IDs', () => {
    expect(validateEID('').isValid).toBe(false);
    expect(validateEID('12345').isValid).toBe(false);
    expect(validateEID('INVALID_FORMAT').isValid).toBe(false);
  });

  it('extracts public e-ID without secret suffix', () => {
    expect(getPublicEID('DEU87AST46RAC38A-XYZ')).toBe('DEU87AST46RAC38A');
    expect(getPublicEID('DEU123456789012')).toBe('DEU123456789012');
  });

  it('builds authority inspection text containing required details', () => {
    const text = buildAuthorityInspectionText({
      pilotName: 'Lukas Bootz',
      eId: 'DEU87AST46RAC38A-XYZ',
      licenseType: 'A1/A3',
      insuranceNumber: 'VERS-99281'
    });
    expect(text).toContain('Lukas Bootz');
    expect(text).toContain('DEU87AST46RAC38A');
    expect(text).not.toContain('XYZ'); // Secret part stripped
    expect(text).toContain('A1/A3');
    expect(text).toContain('VERS-99281');
  });

  it('provides list of authority portals', () => {
    expect(AUTHORITY_PORTALS.length).toBeGreaterThanOrEqual(4);
    const dePortal = AUTHORITY_PORTALS.find(p => p.countryCode === 'DE');
    expect(dePortal?.portalName).toContain('LBA');
  });
});
