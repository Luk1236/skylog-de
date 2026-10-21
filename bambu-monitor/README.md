# Bambu-Monitor für den Raspberry Pi

Ein kleines Python-Programm. Es verbindet sich im Heimnetz direkt mit deinem Bambu-Lab-Drucker (H2S, H2D, X1, P1, A1) und meldet:

- **Druck gestartet**, **Fortschritt** (z. B. alle 10 %), Schicht, Restzeit
- **Druck fertig** (mit Dauer), **abgebrochen** oder **fehlgeschlagen**
- **Pausen** (z. B. Filament leer) und **Fehlercodes** / **HMS-Meldungen**
- Temperaturen von Düse, Bett und Kammer
- **Drucker nicht erreichbar** (nach 5 Minuten ohne Verbindung)

Die Meldungen erscheinen im Log. Wenn du willst, kommen sie auch als **Push aufs Handy** (über ntfy). Außerdem kann bei jedem Ereignis ein **eigener Befehl** laufen. Dort kommt später die Abräum-Automatik hin.

Das Programm braucht keine Cloud und kein Konto. Es nutzt die lokale MQTT-Schnittstelle des Druckers (Port 8883).

## 1. Drucker vorbereiten

Am Touchscreen des Druckers brauchst du drei Werte:

| Wert | Wo am Drucker |
|---|---|
| **IP-Adresse** | Einstellungen → Netzwerk |
| **Seriennummer** | Einstellungen → Gerät (steht auch in Bambu Studio unter „Gerät“) |
| **Zugangscode** (8 Zeichen) | Einstellungen → Netzwerk → LAN-Modus / Zugangscode |

Gib dem Drucker im Router am besten eine **feste IP**, sonst findet der Pi ihn nach einem Neustart vielleicht nicht mehr.

> **Wichtig, falls die Verbindung abgelehnt wird:** Neuere Bambu-Firmware lässt fremde Programme nur noch eingeschränkt zu. Wenn der Monitor „Verbindung abgelehnt“ meldet, obwohl der Zugangscode stimmt, schalte am Drucker **LAN-Modus** und **Entwicklermodus** ein (Einstellungen → Netzwerk). Für die spätere Abräum-Automatik brauchst du den Entwicklermodus sowieso, weil der Pi den Drucker dann auch steuern muss. Der Nachteil: Im LAN-Modus geht Bambu Handy nur noch im eigenen WLAN.

## 2. Raspberry Pi einrichten

**Am einfachsten:** Kopiere den Ordner auf den Pi, z. B. auf den Desktop. Öffne darin ein Terminal und führe `sh installieren.sh` aus. Das Skript installiert alles, lässt dich die Druckerdaten eintragen und richtet auf Wunsch den Autostart ein. Die Schritte 2 bis 4 unten sind dann schon erledigt.

Von Hand geht es so: Raspberry Pi OS (Bookworm oder neuer). Python ist schon dabei, du brauchst nur noch die MQTT-Bibliothek:

```bash
sudo apt update
sudo apt install -y python3-paho-mqtt
```

Kopiere den Ordner `bambu-monitor` nach `~/bambu-monitor` auf den Pi, zum Beispiel mit `git clone` oder per USB-Stick/`scp`. Dann:

```bash
cd ~/bambu-monitor
cp config.example.ini config.ini
nano config.ini        # IP, Seriennummer und Zugangscode eintragen
```

## 3. Testen

```bash
python3 bambu_monitor.py
```

So sollte es aussehen:

```
2026-10-20 13:26:33 INFO    Verbunden mit 192.168.178.50
2026-10-20 13:26:33 INFO    [status] Verbunden: Drucker bereit. Düse 25 °C | Bett 24 °C | Kammer 23 °C
2026-10-20 13:26:34 INFO    [start] Druck gestartet: "Kabelhalter" startet.
2026-10-20 13:26:34 INFO    [fortschritt] 10 % gedruckt: 10 % | Schicht 20/150 | noch 1 h 35 min | Düse 219/220 °C | Bett 65/65 °C
2026-10-20 15:01:12 INFO    [fertig] Druck fertig: "Kabelhalter" ist fertig nach 1 h 35 min.
```

Beenden mit `Strg+C`.

Zur Fehlersuche gibt es `--roh`. Damit erscheint jede Nachricht des Druckers als JSON. `--debug` zeigt zusätzlich mehr Details.

## 4. Automatisch beim Hochfahren starten

```bash
cd ~/bambu-monitor
# Benutzername und Pfade in der Dienstdatei auf deinen Benutzer anpassen:
sed -i "s#/home/pi#$HOME#g; s#User=pi#User=$USER#" bambu-monitor.service
sudo cp bambu-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bambu-monitor

# Live mitlesen:
journalctl -u bambu-monitor -f
```

Neu starten nach einer Änderung an `config.ini`: `sudo systemctl restart bambu-monitor`

## 5. Push aufs Handy (optional)

1. Installiere die kostenlose App **ntfy** (Android/iOS).
2. Denk dir ein langes, zufälliges Thema aus, z. B. `drucker-k7f3q9x2m`. Wer das Thema kennt, kann mitlesen, also behandle es wie ein Passwort.
3. Abonniere das Thema in der App und trag es in `config.ini` ein:
   ```ini
   [melden]
   ntfy_thema = drucker-k7f3q9x2m
   ```
4. Mit `ereignisse = ...` legst du fest, was als Push kommt. Fortschritt ist standardmäßig aus, damit das Handy nicht ständig piept.

## 6. Eigener Befehl bei Ereignissen

In `config.ini` kannst du unter `befehl =` ein Skript eintragen. Es läuft bei **jedem** Ereignis und bekommt diese Umgebungsvariablen:

| Variable | Inhalt |
|---|---|
| `BAMBU_EREIGNIS` | `start`, `fortschritt`, `fortgesetzt`, `pausiert`, `fertig`, `fehlgeschlagen`, `abgebrochen`, `fehler`, `fehler_behoben`, `hms`, `hms_behoben`, `verbindung`, `status` |
| `BAMBU_TITEL` / `BAMBU_NACHRICHT` | der Meldungstext |
| `BAMBU_STATUS` | kompletter Zustand als JSON |

`beispiel_ereignis.sh` zeigt, wie das geht. Genau hier hängt später der nächste Schritt ein: Bei `fertig` abkühlen lassen, den Druck abräumen und den nächsten Druck starten.

Außerdem steht der aktuelle Zustand immer in `status.json`. Die Datei wird bei jedem Zustandswechsel sofort aktualisiert, sonst höchstens alle 10 Sekunden, damit die SD-Karte geschont wird.

## Fehlersuche

| Meldung | Lösung |
|---|---|
| `paho-mqtt fehlt` | `sudo apt install python3-paho-mqtt` |
| `Verbindung abgelehnt (Code 5 / Not authorized)` | Zugangscode prüfen. Er kann sich ändern, wenn du den LAN-Modus aus- und wieder einschaltest. Stimmt er, dann LAN-Modus und Entwicklermodus einschalten. |
| Bleibt bei „Verbinde mit Drucker …“ stehen | IP prüfen (`ping 192.168.178.50`). Pi und Drucker müssen im selben Netz sein. |
| Verbunden, aber keine Meldungen | Seriennummer prüfen (Großbuchstaben). Mit `--roh` nachsehen, ob Nachrichten ankommen. |
| Fehlercode verstehen | Code (z. B. `0700_8011`) in Bambu Handy oder im [Bambu-Wiki](https://wiki.bambulab.com/en/hms/home) suchen |

## Tests

```bash
python3 -m unittest -v
```
