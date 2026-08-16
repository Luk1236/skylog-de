export interface AuthorityPortal {
  countryCode: string;
  countryName: string;
  portalName: string;
  url: string;
}

export const AUTHORITY_PORTALS: AuthorityPortal[] = [
  {
    countryCode: 'DE',
    countryName: 'Deutschland',
    portalName: 'LBA OpenUAV Portal',
    url: 'https://uas-registration.lba-openuav.de'
  },
  {
    countryCode: 'AT',
    countryName: 'Österreich',
    portalName: 'Austro Control Dronespace',
    url: 'https://dronespace.at'
  },
  {
    countryCode: 'CH',
    countryName: 'Schweiz',
    portalName: 'BAZL UAS Portal',
    url: 'https://www.uas.admin.ch'
  },
  {
    countryCode: 'NL',
    countryName: 'Niederlande',
    portalName: 'RDW Drone Registratie',
    url: 'https://www.rdw.nl/particulier/voertuigen/drones'
  },
  {
    countryCode: 'EU',
    countryName: 'Europäische Union',
    portalName: 'EASA Civil Drones',
    url: 'https://www.easa.europa.eu/en/domains/civil-drones'
  }
];

/**
 * Validates whether a given string matches the standard EU e-ID format.
 * Format: 3-letter country code + 12-13 alphanumeric characters + optional 3-char secret suffix (after hyphen)
 * Example: DEU123456789012 or DEU123456789012-abc
 */
export function validateEID(eid: string): { isValid: boolean; formatted: string; reason?: string } {
  if (!eid || !eid.trim()) {
    return { isValid: false, formatted: '', reason: 'e-ID darf nicht leer sein' };
  }

  const cleaned = eid.trim().toUpperCase();
  // Regex pattern for EU e-IDs (e.g. DEU87ast46rac38a or DEU87ast46rac38a-xyz)
  const pattern = /^[A-Z]{3}[A-Z0-9]{12,13}(-[A-Z0-9]{3})?$/;

  if (!pattern.test(cleaned)) {
    return {
      isValid: false,
      formatted: cleaned,
      reason: 'Format entspricht nicht dem EU-Schema (z.B. DEU123456789012 oder DEU123456789012-xyz)'
    };
  }

  return { isValid: true, formatted: cleaned };
}

/**
 * Extracts the public part of the e-ID (without secret suffix after hyphen),
 * which is intended to be attached physically to the drone.
 */
export function getPublicEID(eid: string): string {
  const parts = eid.trim().split('-');
  return parts[0].toUpperCase();
}

/**
 * Generates official check string for authority inspection QR code
 */
export function buildAuthorityInspectionText(payload: {
  pilotName?: string;
  eId?: string;
  licenseType?: string;
  insuranceNumber?: string;
}): string {
  const lines: string[] = ['--- SKYLOG DE BEHÖRDEN-NACHWEIS ---'];
  if (payload.pilotName) lines.push(`Betreiber/Pilot: ${payload.pilotName}`);
  if (payload.eId) lines.push(`e-ID: ${getPublicEID(payload.eId)}`);
  if (payload.licenseType) lines.push(`Nachweis: ${payload.licenseType}`);
  if (payload.insuranceNumber) lines.push(`Versicherung-Nr: ${payload.insuranceNumber}`);
  lines.push(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`);
  return lines.join('\n');
}
