#!/usr/bin/env python3
"""Überwachung für Bambu-Lab-Drucker (H2S, H2D, X1, P1, A1) auf dem Raspberry Pi.

Verbindet sich im Heimnetz per MQTT direkt mit dem Drucker und meldet:
Druckstart, Fortschritt, Ende, Abbruch, Pausen, Fehlercodes und HMS-Meldungen.
Optional gehen die Meldungen per ntfy aufs Handy, und für jedes Ereignis kann
ein eigener Befehl laufen (z. B. später ein Skript, das den Druck abräumt).

Start:  python3 bambu_monitor.py -c config.ini
"""
from __future__ import annotations

import argparse
import configparser
import json
import logging
import logging.handlers
import os
import shlex
import ssl
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger("bambu")

MQTT_PORT = 8883
MQTT_USER = "bblp"

# Diesen Fehlercode setzt der Drucker, wenn ein Druck abgebrochen wird.
ERROR_CANCELLED = 0x0300400C

IDLE_STATES = {"IDLE", "FINISH", "FAILED"}

STATE_NAMES = {
    "IDLE": "bereit",
    "INIT": "startet",
    "SLICING": "slict",
    "PREPARE": "bereitet vor",
    "RUNNING": "druckt",
    "PAUSE": "pausiert",
    "FINISH": "fertig",
    "FAILED": "fehlgeschlagen",
    "OFFLINE": "offline",
}

HMS_SEVERITY = {1: "kritisch", 2: "schwer", 3: "normal", 4: "Hinweis"}
HMS_INFO_URL = "https://wiki.bambulab.com/en/hms/home"

ALL_EVENTS = (
    "status", "start", "fortschritt", "fortgesetzt", "pausiert", "fertig",
    "fehlgeschlagen", "abgebrochen", "fehler", "fehler_behoben", "hms",
    "hms_behoben", "verbindung",
)
DEFAULT_NOTIFY = "start, fertig, fehlgeschlagen, abgebrochen, pausiert, fehler, hms, verbindung"


@dataclass
class Event:
    kind: str      # einer der Namen aus ALL_EVENTS
    title: str
    message: str


def format_error_code(code: int) -> str:
    """print_error als Text, wie ihn Bambu Handy anzeigt, z. B. 0300_400C."""
    return f"{code >> 16:04X}_{code & 0xFFFF:04X}"


def format_hms_code(attr: int, code: int) -> str:
    """HMS-Code im Format des Bambu-Wikis, z. B. 0700_2000_0002_0001."""
    return f"{attr >> 16:04X}_{attr & 0xFFFF:04X}_{code >> 16:04X}_{code & 0xFFFF:04X}"


def split_temp(packed: int) -> tuple[int, int]:
    """H2-Serie: unteres Wort ist die Ist-, oberes die Soll-Temperatur."""
    return packed & 0xFFFF, (packed >> 16) & 0xFFFF


def format_minutes(minutes: float) -> str:
    minutes = int(round(minutes))
    if minutes < 60:
        return f"{minutes} min"
    return f"{minutes // 60} h {minutes % 60:02d} min"


def format_temp(temp: tuple[float, float]) -> str:
    current, target = temp
    if target:
        return f"{current:.0f}/{target:.0f} °C"
    return f"{current:.0f} °C"


@dataclass
class PrinterState:
    """Hält den Druckerzustand und erzeugt Ereignisse aus den MQTT-Berichten.

    Der Drucker schickt nach "pushall" einmal alles und danach meist nur die
    geänderten Felder, deshalb werden die Berichte hier zusammengeführt.
    """

    progress_step: int = 10
    gcode_state: str | None = None
    percent: int = 0
    remaining_min: int = 0
    layer: int = 0
    total_layers: int = 0
    job: str = ""
    nozzle_temps: dict[int, tuple[float, float]] = field(default_factory=dict)
    bed_temp: tuple[float, float] | None = None
    chamber_temp: tuple[float, float] | None = None
    print_error: int = 0
    hms: dict[str, str] = field(default_factory=dict)  # Code -> Schweregrad
    started_at: float | None = None
    last_report: float = 0.0
    _progress_mark: int = 0

    def update(self, report: dict) -> list[Event]:
        events: list[Event] = []
        previous = self.gcode_state
        self.last_report = time.time()

        if "mc_percent" in report:
            self.percent = int(report["mc_percent"])
        if "mc_remaining_time" in report:
            self.remaining_min = int(report["mc_remaining_time"])
        if "layer_num" in report:
            self.layer = int(report["layer_num"])
        if "total_layer_num" in report:
            self.total_layers = int(report["total_layer_num"])
        if report.get("subtask_name"):
            self.job = str(report["subtask_name"])
        self._update_temperatures(report)

        # Fehlercode vor dem Zustand übernehmen: ein Abbruch kommt als
        # FAILED + ERROR_CANCELLED und soll nicht als Fehler gemeldet werden.
        if "print_error" in report:
            events.extend(self._update_error(int(report["print_error"])))

        if report.get("gcode_state"):
            self.gcode_state = str(report["gcode_state"]).upper()

        if previous is None and self.gcode_state is not None:
            # Läuft schon ein Druck, kennen wir seine Startzeit nicht (keine Dauer melden).
            self._progress_mark = self.percent // self.progress_step
            events.insert(0, Event("status", "Verbunden",
                                   f"Drucker {self.state_name}. {self.summary()}"))
        elif previous is not None and self.gcode_state != previous:
            events.extend(self._state_changed(previous))

        if "hms" in report and isinstance(report["hms"], list):
            events.extend(self._update_hms(report["hms"]))

        if self.gcode_state == "RUNNING" and self.percent < 100:
            mark = self.percent // self.progress_step
            if mark > self._progress_mark:
                self._progress_mark = mark
                events.append(Event("fortschritt", f"{self.percent} % gedruckt", self.summary()))
        return events

    @property
    def state_name(self) -> str:
        if self.gcode_state is None:
            return "unbekannt"
        return STATE_NAMES.get(self.gcode_state, self.gcode_state.lower())

    def _job_label(self) -> str:
        return f'"{self.job}"' if self.job else "Druck"

    def _state_changed(self, previous: str) -> list[Event]:
        state = self.gcode_state
        job = self._job_label()
        if previous in IDLE_STATES and state not in IDLE_STATES:
            self.started_at = time.time()
            self._progress_mark = 0
            return [Event("start", "Druck gestartet", f"{job} startet.")]
        if previous == "PAUSE" and state == "RUNNING":
            return [Event("fortgesetzt", "Druck läuft weiter", f"{job}: {self.summary()}")]
        if state == "PAUSE":
            reason = ""
            if self.print_error:
                reason = f" Fehlercode {format_error_code(self.print_error)}."
            return [Event("pausiert", "Druck pausiert", f"{job} pausiert bei {self.percent} %.{reason}")]
        if state == "FINISH":
            return [Event("fertig", "Druck fertig", f"{job} ist fertig{self._duration()}.")]
        if state == "FAILED":
            if self.print_error == ERROR_CANCELLED:
                return [Event("abgebrochen", "Druck abgebrochen",
                              f"{job} wurde bei {self.percent} % abgebrochen.")]
            code = f" Fehlercode {format_error_code(self.print_error)}." if self.print_error else ""
            return [Event("fehlgeschlagen", "Druck fehlgeschlagen",
                          f"{job} ist bei {self.percent} % fehlgeschlagen.{code}")]
        log.debug("Zustand %s -> %s", previous, state)
        return []

    def _duration(self) -> str:
        if self.started_at is None:
            return ""
        return f" nach {format_minutes((time.time() - self.started_at) / 60)}"

    def _update_error(self, code: int) -> list[Event]:
        if code == self.print_error:
            return []
        old, self.print_error = self.print_error, code
        if code == 0:
            if old == ERROR_CANCELLED:
                return []
            return [Event("fehler_behoben", "Fehler behoben",
                          f"Fehler {format_error_code(old)} ist nicht mehr aktiv.")]
        if code == ERROR_CANCELLED:
            return []
        return [Event("fehler", "Druckerfehler",
                      f"Fehlercode {format_error_code(code)}. Erklärung in Bambu Handy oder "
                      f"unter {HMS_INFO_URL} (Code suchen).")]

    def _update_hms(self, entries: list) -> list[Event]:
        current: dict[str, str] = {}
        for entry in entries:
            try:
                attr, code = int(entry["attr"]), int(entry["code"])
            except (KeyError, TypeError, ValueError):
                continue
            current[format_hms_code(attr, code)] = HMS_SEVERITY.get(code >> 16, "unbekannt")
        events = []
        for hms_code, severity in current.items():
            if hms_code not in self.hms:
                events.append(Event("hms", f"Druckermeldung ({severity})",
                                    f"HMS {hms_code}. Erklärung: {HMS_INFO_URL} (Code suchen)."))
        for hms_code in self.hms.keys() - current.keys():
            events.append(Event("hms_behoben", "Meldung erledigt", f"HMS {hms_code} ist weg."))
        self.hms = current
        return events

    def _update_temperatures(self, report: dict) -> None:
        device = report.get("device") or {}
        # H2-Serie: Temperaturen stecken gepackt im Block "device".
        extruders = (device.get("extruder") or {}).get("info")
        if isinstance(extruders, list):
            for extruder in extruders:
                if "id" in extruder and "temp" in extruder:
                    self.nozzle_temps[int(extruder["id"])] = split_temp(int(extruder["temp"]))
        elif "nozzle_temper" in report or "nozzle_target_temper" in report:
            current, target = self.nozzle_temps.get(0, (0, 0))
            self.nozzle_temps[0] = (float(report.get("nozzle_temper", current)),
                                    float(report.get("nozzle_target_temper", target)))

        bed = ((device.get("bed") or {}).get("info") or {}).get("temp")
        if bed is not None:
            self.bed_temp = split_temp(int(bed))
        elif "bed_temper" in report or "bed_target_temper" in report:
            current, target = self.bed_temp or (0, 0)
            self.bed_temp = (float(report.get("bed_temper", current)),
                             float(report.get("bed_target_temper", target)))

        chamber = ((device.get("ctc") or {}).get("info") or {}).get("temp")
        if chamber is not None:
            self.chamber_temp = split_temp(int(chamber))
        elif "chamber_temper" in report:
            self.chamber_temp = (float(report["chamber_temper"]), 0)

    def summary(self) -> str:
        parts = []
        if self.gcode_state not in IDLE_STATES and self.gcode_state is not None:
            parts.append(f"{self.percent} %")
            if self.total_layers:
                parts.append(f"Schicht {self.layer}/{self.total_layers}")
            if self.remaining_min:
                parts.append(f"noch {format_minutes(self.remaining_min)}")
        if len(self.nozzle_temps) == 1:
            parts.append(f"Düse {format_temp(next(iter(self.nozzle_temps.values())))}")
        else:
            for index, temp in sorted(self.nozzle_temps.items()):
                parts.append(f"Düse {index + 1} {format_temp(temp)}")
        if self.bed_temp:
            parts.append(f"Bett {format_temp(self.bed_temp)}")
        if self.chamber_temp:
            parts.append(f"Kammer {format_temp(self.chamber_temp)}")
        return " | ".join(parts)

    def to_dict(self) -> dict:
        return {
            "zustand": self.gcode_state,
            "zustand_text": self.state_name,
            "auftrag": self.job,
            "prozent": self.percent,
            "rest_minuten": self.remaining_min,
            "schicht": self.layer,
            "schichten_gesamt": self.total_layers,
            "duesen": {str(k): {"ist": v[0], "soll": v[1]} for k, v in self.nozzle_temps.items()},
            "bett": {"ist": self.bed_temp[0], "soll": self.bed_temp[1]} if self.bed_temp else None,
            "kammer": {"ist": self.chamber_temp[0], "soll": self.chamber_temp[1]} if self.chamber_temp else None,
            "fehlercode": format_error_code(self.print_error) if self.print_error else None,
            "hms": [{"code": c, "schwere": s} for c, s in self.hms.items()],
            "letzter_bericht": self.last_report,
        }


class Notifier:
    """Gibt Ereignisse aus: Log, optional ntfy-Push und optional eigener Befehl."""

    def __init__(self, ntfy_server: str, ntfy_topic: str, command: str, notify_kinds: set[str]):
        self.ntfy_url = f"{ntfy_server.rstrip('/')}/{ntfy_topic}" if ntfy_topic else ""
        self.command = command
        self.notify_kinds = notify_kinds

    def handle(self, event: Event, state: PrinterState) -> None:
        level = logging.WARNING if event.kind in ("fehler", "hms", "fehlgeschlagen", "verbindung") else logging.INFO
        log.log(level, "[%s] %s: %s", event.kind, event.title, event.message)
        if self.ntfy_url and event.kind in self.notify_kinds:
            threading.Thread(target=self._send_ntfy, args=(event,), daemon=True).start()
        if self.command:
            threading.Thread(target=self._run_command, args=(event, state.to_dict()), daemon=True).start()

    def _send_ntfy(self, event: Event) -> None:
        urgent = event.kind in ("fehler", "fehlgeschlagen", "pausiert", "hms")
        query = urllib.parse.urlencode({
            "title": event.title,
            "priority": "high" if urgent else "default",
            "tags": "warning" if urgent else "printer",
        })
        request = urllib.request.Request(f"{self.ntfy_url}?{query}", data=event.message.encode("utf-8"),
                                         method="POST")
        try:
            urllib.request.urlopen(request, timeout=10).close()
        except OSError as exc:
            log.warning("ntfy-Nachricht nicht gesendet: %s", exc)

    def _run_command(self, event: Event, status: dict) -> None:
        env = dict(os.environ,
                   BAMBU_EREIGNIS=event.kind,
                   BAMBU_TITEL=event.title,
                   BAMBU_NACHRICHT=event.message,
                   BAMBU_STATUS=json.dumps(status, ensure_ascii=False))
        try:
            result = subprocess.run(shlex.split(self.command), env=env, timeout=600)
            if result.returncode != 0:
                log.warning("Befehl endete mit Code %s", result.returncode)
        except (OSError, subprocess.TimeoutExpired) as exc:
            log.warning("Befehl fehlgeschlagen: %s", exc)


class BambuMonitor:
    PUSHALL_INTERVAL = 600      # alle 10 min den vollständigen Zustand anfordern
    STATUS_WRITE_INTERVAL = 10  # Statusdatei höchstens alle 10 s schreiben (schont die SD-Karte)
    OFFLINE_ALERT_AFTER = 300   # erst nach 5 min ohne Verbindung melden

    def __init__(self, config: configparser.ConfigParser, raw: bool = False):
        printer = config["drucker"]
        self.ip = printer["ip"].strip()
        self.serial = printer["seriennummer"].strip()
        self.access_code = printer["zugangscode"].strip()
        monitor = config["monitor"]
        self.status_interval = monitor.getint("statusmeldung_sekunden", 60)
        status_file = monitor.get("status_datei", "").strip()
        self.status_file = Path(status_file) if status_file else None
        self.raw = raw

        self.state = PrinterState(progress_step=max(1, monitor.getint("fortschritt_schritt", 10)))
        notify = config["melden"]
        kinds = {k.strip() for k in notify.get("ereignisse", DEFAULT_NOTIFY).split(",") if k.strip()}
        unknown = kinds - set(ALL_EVENTS)
        if unknown:
            log.warning("Unbekannte Ereignisse in [melden] ereignisse: %s", ", ".join(sorted(unknown)))
        self.notifier = Notifier(notify.get("ntfy_server", "https://ntfy.sh"),
                                 notify.get("ntfy_thema", "").strip(),
                                 notify.get("befehl", "").strip(), kinds)

        self.lock = threading.Lock()
        self.client = None
        self.connected = False
        self.disconnected_since: float | None = time.time()
        self.offline_alerted = False
        self.last_pushall = 0.0
        self.last_status_log = 0.0
        self.last_status_write = 0.0
        self.last_written_state: str | None = None
        self.status_dirty = False

    # --- MQTT ---------------------------------------------------------------

    def _create_client(self):
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            sys.exit("paho-mqtt fehlt. Installieren mit: sudo apt install python3-paho-mqtt")
        client_id = f"pi-monitor-{uuid.uuid4().hex[:8]}"
        if hasattr(mqtt, "CallbackAPIVersion"):  # paho-mqtt 2.x
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
        else:                                    # paho-mqtt 1.x (Raspberry Pi OS Bookworm)
            client = mqtt.Client(client_id=client_id)
        client.username_pw_set(MQTT_USER, self.access_code)
        # Der Drucker nutzt ein selbst signiertes Zertifikat, daher keine Prüfung.
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        client.tls_set_context(context)
        client.reconnect_delay_set(min_delay=2, max_delay=60)
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        return client

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        rc = getattr(reason_code, "value", reason_code)
        if rc != 0:
            hint = ""
            if rc in (4, 5, 134, 135):
                hint = (" Zugangscode prüfen. Hilft das nicht: am Drucker LAN-Modus und "
                        "Entwicklermodus einschalten (siehe README).")
            log.error("Verbindung abgelehnt (Code %s).%s", reason_code, hint)
            return
        log.info("Verbunden mit %s", self.ip)
        self.connected = True
        client.subscribe(f"device/{self.serial}/report")
        self._request_pushall()
        with self.lock:
            if self.offline_alerted:
                self.notifier.handle(Event("verbindung", "Drucker wieder erreichbar",
                                           "Die Verbindung zum Drucker steht wieder."), self.state)
            self.offline_alerted = False
            self.disconnected_since = None

    def _on_disconnect(self, client, userdata, *args):
        # paho 1.x: (rc)  –  paho 2.x: (flags, reason_code, properties)
        reason = args[1] if len(args) >= 2 else (args[0] if args else 0)
        if self.connected:
            log.warning("Verbindung getrennt (%s), versuche neu zu verbinden ...", reason)
        self.connected = False
        if self.disconnected_since is None:
            self.disconnected_since = time.time()

    def _on_message(self, client, userdata, message):
        try:
            data = json.loads(message.payload)
        except ValueError:
            log.debug("Keine gültige JSON-Nachricht empfangen")
            return
        if self.raw:
            log.info("ROH: %s", json.dumps(data, ensure_ascii=False))
        report = data.get("print")
        if not isinstance(report, dict):
            return
        with self.lock:
            events = self.state.update(report)
            self.status_dirty = True
            for event in events:
                self.notifier.handle(event, self.state)

    def _request_pushall(self):
        payload = {"pushing": {"sequence_id": "0", "command": "pushall", "version": 1, "push_target": 1}}
        self.client.publish(f"device/{self.serial}/request", json.dumps(payload))
        self.last_pushall = time.time()

    # --- Hauptschleife ------------------------------------------------------

    def run(self):
        self.client = self._create_client()
        log.info("Verbinde mit Drucker %s (Seriennummer %s) ...", self.ip, self.serial)
        self.client.connect_async(self.ip, MQTT_PORT, keepalive=60)
        self.client.loop_start()
        try:
            while True:
                time.sleep(1)
                self._tick()
        except KeyboardInterrupt:
            log.info("Beendet.")
        finally:
            self.client.loop_stop()
            self.client.disconnect()

    def _tick(self):
        now = time.time()
        if self.connected and now - self.last_pushall > self.PUSHALL_INTERVAL:
            self._request_pushall()

        with self.lock:
            since = self.disconnected_since
            if not self.connected and since and not self.offline_alerted \
                    and now - since > self.OFFLINE_ALERT_AFTER:
                self.offline_alerted = True
                self.notifier.handle(Event("verbindung", "Drucker nicht erreichbar",
                                           f"Seit {format_minutes((now - since) / 60)} keine Verbindung "
                                           f"zu {self.ip}."), self.state)

            active = self.state.gcode_state not in IDLE_STATES and self.state.gcode_state is not None
            if self.connected and active and self.status_interval > 0 \
                    and now - self.last_status_log >= self.status_interval:
                self.last_status_log = now
                log.info("Status: %s | %s", self.state.state_name, self.state.summary())

            # Zustandswechsel sofort schreiben, sonst nur alle paar Sekunden.
            state_changed = self.state.gcode_state != self.last_written_state
            if self.status_file and self.status_dirty and \
                    (state_changed or now - self.last_status_write >= self.STATUS_WRITE_INTERVAL):
                self._write_status(dict(self.state.to_dict(), verbunden=self.connected))

    def _write_status(self, status: dict):
        self.last_status_write = time.time()
        self.last_written_state = self.state.gcode_state
        self.status_dirty = False
        tmp = self.status_file.with_suffix(".tmp")
        try:
            tmp.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(tmp, self.status_file)
        except OSError as exc:
            log.warning("Statusdatei nicht geschrieben: %s", exc)


def load_config(path: Path) -> configparser.ConfigParser:
    config = configparser.ConfigParser()
    if not config.read(path, encoding="utf-8"):
        sys.exit(f"Konfiguration {path} nicht gefunden. Vorlage: config.example.ini kopieren.")
    for section in ("drucker", "monitor", "melden"):
        if not config.has_section(section):
            config.add_section(section)
    missing = [key for key in ("ip", "seriennummer", "zugangscode") if not config["drucker"].get(key, "").strip()]
    if missing:
        sys.exit(f"In [drucker] fehlt: {', '.join(missing)}")
    return config


def setup_logging(log_file: str, debug: bool) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if log_file:
        handlers.append(logging.handlers.RotatingFileHandler(log_file, maxBytes=1_000_000, backupCount=3,
                                                             encoding="utf-8"))
    logging.basicConfig(level=logging.DEBUG if debug else logging.INFO,
                        format="%(asctime)s %(levelname)-7s %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S", handlers=handlers)
    logging.getLogger("paho").setLevel(logging.WARNING)


def main() -> None:
    parser = argparse.ArgumentParser(description="Überwacht einen Bambu-Lab-Drucker im Heimnetz.")
    parser.add_argument("-c", "--config", default=str(Path(__file__).with_name("config.ini")),
                        help="Pfad zur Konfiguration (Standard: config.ini neben dem Skript)")
    parser.add_argument("--debug", action="store_true", help="ausführliche Ausgabe")
    parser.add_argument("--roh", action="store_true",
                        help="jede Nachricht des Druckers als JSON ausgeben (zur Fehlersuche)")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    setup_logging(config["monitor"].get("log_datei", "").strip(), args.debug)
    BambuMonitor(config, raw=args.roh).run()


if __name__ == "__main__":
    main()
