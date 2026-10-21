#!/bin/sh
# Einrichtung auf dem Raspberry Pi. Einmal im Terminal ausführen:
#   sh installieren.sh
# Der Ordner kann liegen, wo er will (z. B. auf dem Desktop).
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "== Installiere die MQTT-Bibliothek (braucht das Passwort für sudo) =="
sudo apt-get update -qq
sudo apt-get install -y python3-paho-mqtt

chmod +x bambu_monitor.py beispiel_ereignis.sh

if [ ! -f config.ini ]; then
    cp config.example.ini config.ini
    echo
    echo "== config.ini angelegt =="
    echo "Trage jetzt IP, Seriennummer und Zugangscode deines Druckers ein."
    echo "Speichern mit Strg+O, Enter; schließen mit Strg+X."
    printf "Weiter mit Enter ... "
    read _
    nano config.ini
fi

echo
printf "Soll der Monitor automatisch beim Hochfahren starten? (j/n) "
read answer
case "$answer" in
    j|J|ja|Ja)
        case "$DIR" in
            *" "*) echo "Der Ordnerpfad enthält ein Leerzeichen ($DIR). Bitte umbenennen und erneut starten."; exit 1 ;;
        esac
        sed -e "s#/home/pi/bambu-monitor#$DIR#g" -e "s#User=pi#User=$(id -un)#" \
            bambu-monitor.service > /tmp/bambu-monitor.service
        sudo mv /tmp/bambu-monitor.service /etc/systemd/system/bambu-monitor.service
        sudo systemctl daemon-reload
        sudo systemctl enable bambu-monitor
        sudo systemctl restart bambu-monitor
        echo
        echo "== Autostart eingerichtet =="
        echo "Live mitlesen:     journalctl -u bambu-monitor -f"
        echo "Neu starten:       sudo systemctl restart bambu-monitor"
        echo "Autostart aus:     sudo systemctl disable --now bambu-monitor"
        ;;
    *)
        echo
        echo "== Fertig =="
        echo "Starten mit:  python3 \"$DIR/bambu_monitor.py\""
        echo "Beenden mit Strg+C. Autostart später: dieses Skript noch mal ausführen."
        ;;
esac
