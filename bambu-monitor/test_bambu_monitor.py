"""Tests für die Auswertung der Druckerberichte. Start: python3 -m unittest -v"""
import unittest

from bambu_monitor import ERROR_CANCELLED, PrinterState, format_hms_code, split_temp


def kinds(events):
    return [e.kind for e in events]


class PrinterStateTest(unittest.TestCase):
    def setUp(self):
        self.state = PrinterState(progress_step=10)

    def test_first_report_only_reports_status(self):
        events = self.state.update({"gcode_state": "RUNNING", "mc_percent": 42, "subtask_name": "Halter"})
        self.assertEqual(kinds(events), ["status"])

    def test_progress_every_step(self):
        self.state.update({"gcode_state": "RUNNING", "mc_percent": 42})
        self.assertEqual(kinds(self.state.update({"mc_percent": 49})), [])
        self.assertEqual(kinds(self.state.update({"mc_percent": 50})), ["fortschritt"])
        self.assertEqual(kinds(self.state.update({"mc_percent": 55})), [])
        self.assertEqual(kinds(self.state.update({"mc_percent": 71})), ["fortschritt"])

    def test_full_print_cycle(self):
        self.state.update({"gcode_state": "IDLE"})
        self.assertEqual(kinds(self.state.update({"gcode_state": "PREPARE", "mc_percent": 0})), ["start"])
        self.assertEqual(kinds(self.state.update({"gcode_state": "RUNNING", "mc_percent": 5})), [])
        self.assertEqual(kinds(self.state.update({"mc_percent": 10})), ["fortschritt"])
        events = self.state.update({"gcode_state": "FINISH", "mc_percent": 100})
        self.assertEqual(kinds(events), ["fertig"])
        self.assertIn("nach", events[0].message)

    def test_new_print_resets_progress(self):
        self.state.update({"gcode_state": "RUNNING", "mc_percent": 90})
        self.state.update({"gcode_state": "FINISH", "mc_percent": 100})
        self.state.update({"gcode_state": "PREPARE", "mc_percent": 0})
        self.state.update({"gcode_state": "RUNNING", "mc_percent": 0})
        self.assertEqual(kinds(self.state.update({"mc_percent": 10})), ["fortschritt"])

    def test_cancel_is_not_an_error(self):
        self.state.update({"gcode_state": "RUNNING", "mc_percent": 30})
        events = self.state.update({"gcode_state": "FAILED", "print_error": ERROR_CANCELLED})
        self.assertEqual(kinds(events), ["abgebrochen"])
        self.assertEqual(kinds(self.state.update({"gcode_state": "IDLE", "print_error": 0})), [])

    def test_failure_with_error_code(self):
        self.state.update({"gcode_state": "RUNNING", "mc_percent": 30})
        events = self.state.update({"gcode_state": "FAILED", "print_error": 0x07008011})
        self.assertEqual(kinds(events), ["fehler", "fehlgeschlagen"])
        self.assertIn("0700_8011", events[1].message)

    def test_pause_and_resume(self):
        self.state.update({"gcode_state": "RUNNING", "mc_percent": 30})
        events = self.state.update({"gcode_state": "PAUSE", "print_error": 0x07008011})
        self.assertEqual(kinds(events), ["fehler", "pausiert"])
        events = self.state.update({"gcode_state": "RUNNING", "print_error": 0})
        self.assertEqual(kinds(events), ["fehler_behoben", "fortgesetzt"])

    def test_hms_reported_once(self):
        self.state.update({"gcode_state": "RUNNING"})
        hms = [{"attr": 0x07002000, "code": 0x00020001}]
        events = self.state.update({"hms": hms})
        self.assertEqual(kinds(events), ["hms"])
        self.assertIn("0700_2000_0002_0001", events[0].message)
        self.assertEqual(kinds(self.state.update({"hms": hms})), [])
        self.assertEqual(kinds(self.state.update({"hms": []})), ["hms_behoben"])

    def test_h2_packed_temperatures(self):
        self.state.update({
            "gcode_state": "RUNNING",
            "device": {
                "extruder": {"info": [{"id": 0, "temp": (220 << 16) | 218}]},
                "bed": {"info": {"temp": (65 << 16) | 64}},
                "ctc": {"info": {"temp": 38}},
            },
        })
        self.assertEqual(self.state.nozzle_temps[0], (218, 220))
        self.assertEqual(self.state.bed_temp, (64, 65))
        self.assertEqual(self.state.chamber_temp, (38, 0))
        self.assertIn("Düse 218/220 °C", self.state.summary())

    def test_classic_temperatures(self):
        self.state.update({"gcode_state": "IDLE", "nozzle_temper": 25.3, "bed_temper": 24.0,
                           "bed_target_temper": 0})
        self.assertEqual(self.state.nozzle_temps[0], (25.3, 0))
        self.assertEqual(self.state.bed_temp, (24.0, 0))

    def test_helpers(self):
        self.assertEqual(split_temp((200 << 16) | 25), (25, 200))
        self.assertEqual(format_hms_code(0x03000100, 0x00010007), "0300_0100_0001_0007")


if __name__ == "__main__":
    unittest.main()
