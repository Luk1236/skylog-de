/** Nach dieser Zeit im Hintergrund wird die App bei aktiver PIN wieder gesperrt. */
export const AUTO_SPERRE_MS = 60_000;

/** true, wenn die App lange genug im Hintergrund war, um erneut zu sperren.
 *  Reine Funktion, damit die Zeitlogik ohne Browser testbar bleibt. */
export function sollSperren(hintergrundSeit: number | null, jetzt: number = Date.now()): boolean {
  return hintergrundSeit !== null && jetzt - hintergrundSeit >= AUTO_SPERRE_MS;
}
