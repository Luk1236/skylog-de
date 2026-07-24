import { Polygon, Popup } from 'react-leaflet';
import { stufeFuer, type Ed269Zone } from '../services/ed269';

const FARBE: Record<string, string> = {
  kritisch: '#b91c1c',
  hinweis: '#f59e0b',
  frei: '#059669',
};

/** Zeichnet importierte ED-269-Zonen auf die Karte.
 *
 *  Farbgebung wie beim deutschen Overlay, damit Rot im Ausland dasselbe
 *  bedeutet wie zu Hause. Deckkraft bewusst niedrig — die Zonen sollen die
 *  Karte einfärben, nicht sie ersetzen. */
export function EuZoneLayer({ zonen }: { zonen: Ed269Zone[] }) {
  return (
    <>
      {zonen.map((z) =>
        z.polygone.map((ring, i) => {
          const stufe = stufeFuer(z.beschraenkung);
          const farbe = FARBE[stufe];
          return (
            <Polygon
              key={`${z.id}-${i}`}
              positions={ring}
              pathOptions={{ color: farbe, weight: 1, fillColor: farbe, fillOpacity: 0.18 }}
            >
              <Popup>
                <div className="p-1 text-xs min-w-[160px]">
                  <p className="font-bold text-slate-800 mb-0.5">{z.name}</p>
                  <p className="text-slate-500 mb-1">{z.land} · {z.beschraenkung}</p>
                  {z.hinweis && <p className="text-slate-600 mb-1">{z.hinweis}</p>}
                  {(z.untergrenzeM !== undefined || z.obergrenzeM !== undefined) && (
                    <p className="text-slate-400 text-[10px]">
                      {z.untergrenzeM ?? 0}–{z.obergrenzeM ?? '?'} m
                    </p>
                  )}
                  {z.gruende.length > 0 && (
                    <p className="text-slate-400 text-[10px] mt-0.5">{z.gruende.join(', ')}</p>
                  )}
                </div>
              </Popup>
            </Polygon>
          );
        })
      )}
    </>
  );
}
