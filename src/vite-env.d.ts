/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Basis-URL des Servers (z.B. die Vercel-Adresse) fuer die Android-App.
   *  Im Browser leer lassen: dort laufen /api-Aufrufe gegen denselben Server. */
  readonly VITE_API_BASE?: string;
}

/** Versionsangabe, beim Bauen in vite.config.ts eingesetzt. */
declare const __APP_VERSION__: string;
