#!/bin/sh
# Beispiel für "befehl" in config.ini: läuft bei jedem Ereignis des Monitors.
# Hier kommt später z. B. das Abräumen des Drucks hin.

case "$BAMBU_EREIGNIS" in
  fertig)
    echo "$(date '+%F %T') Druck fertig: $BAMBU_NACHRICHT" >> "$HOME/bambu-ereignisse.txt"
    ;;
  fehler|fehlgeschlagen|pausiert)
    echo "$(date '+%F %T') ACHTUNG $BAMBU_TITEL: $BAMBU_NACHRICHT" >> "$HOME/bambu-ereignisse.txt"
    ;;
esac
