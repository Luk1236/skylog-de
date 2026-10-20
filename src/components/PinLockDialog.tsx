import { useSprache } from '../lib/sprache';
import { useEffect, useState } from 'react';
import { Lock, Unlock, AlertCircle, Check } from 'lucide-react';
import { Dialog, Knopf } from './ui';
import { setPin, verifyPin, removePin, isPinEnabled, sperreRestSekunden } from '../services/pinProtection';

interface Props {
  mode: 'unlock' | 'setup' | 'settings';
  onUnlocked?: () => void;
  onClose?: () => void;
}

export function PinLockDialog({ mode, onUnlocked, onClose }: Props) {
  const { tx } = useSprache();
  const [pin, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>(mode === 'setup' ? 'enter' : 'enter');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // PBKDF2 braucht auf dem Handy einen Moment - solange keine Eingaben annehmen.
  const [pruefe, setPruefe] = useState(false);
  const [gesperrt, setGesperrt] = useState(() => sperreRestSekunden());

  const isEnabled = isPinEnabled();

  // Countdown, solange nach Fehlversuchen gesperrt ist.
  useEffect(() => {
    if (gesperrt <= 0) return;
    const t = setTimeout(() => setGesperrt(sperreRestSekunden()), 1000);
    return () => clearTimeout(t);
  }, [gesperrt]);

  const pruefeEntsperren = async (eingabe: string) => {
    setPruefe(true);
    const r = await verifyPin(eingabe);
    setPruefe(false);
    if (r.ok) {
      onUnlocked?.();
      return;
    }
    setPinInput('');
    setGesperrt(r.gesperrtSekunden);
    setErrorMsg(r.gesperrtSekunden > 0
      ? 'Zu viele Fehlversuche. Bitte kurz warten.'
      : 'Falscher PIN. Bitte erneut versuchen.');
  };

  const speichereNeuePin = async (eingabe: string) => {
    setPruefe(true);
    await setPin(eingabe);
    setPruefe(false);
    setSuccessMsg('PIN erfolgreich eingerichtet!');
    setTimeout(() => {
      onClose?.();
    }, 1000);
  };

  const handleDigit = (digit: string) => {
    if (pruefe || gesperrt > 0) return;
    if (errorMsg) setErrorMsg('');
    if (step === 'enter' && pin.length < 4) {
      const next = pin + digit;
      setPinInput(next);
      if (mode === 'unlock' && next.length === 4) {
        void pruefeEntsperren(next);
      } else if (mode === 'setup' && next.length === 4) {
        setStep('confirm');
      }
    } else if (step === 'confirm' && confirmPin.length < 4) {
      const next = confirmPin + digit;
      setConfirmPin(next);
      if (next.length === 4) {
        if (next === pin) {
          void speichereNeuePin(next);
        } else {
          setErrorMsg('PINs stimmen nicht überein. Erneut versuchen.');
          setPinInput('');
          setConfirmPin('');
          setStep('enter');
        }
      }
    }
  };

  const handleDeleteDigit = () => {
    if (step === 'enter') {
      setPinInput(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  const handleDisablePin = () => {
    removePin();
    setSuccessMsg('PIN-Schutz wurde deaktiviert.');
    setTimeout(() => {
      onClose?.();
    }, 1000);
  };

  const currentVal = step === 'enter' ? pin : confirmPin;

  const schliessbar = mode !== 'unlock' && !!onClose;

  return (
    // Eigene Ebene über allen anderen Dialogen; beim Entsperren zusätzlich deckend,
    // damit die App dahinter nicht zu sehen ist.
    <div className={`fixed inset-0 z-[200] ${mode === 'unlock' ? 'bg-slate-100' : ''}`}>
      <Dialog
        titel={mode === 'unlock' ? 'SkyLog DE Entsperren' : mode === 'setup' ? 'Bildschirmsperre einrichten' : 'Bildschirmsperre (PIN)'}
        untertitel={gesperrt > 0
          ? `Gesperrt – noch ${gesperrt} s`
          : pruefe
            ? 'Wird geprüft …'
            : mode === 'unlock' ? 'Gib deinen 4-stelligen PIN ein' : step === 'enter' ? 'Gib 4 Ziffern ein' : 'PIN zur Bestätigung wiederholen'}
        icon={Lock}
        ton="blau"
        breite="sm"
        schliessbar={schliessbar}
        onClose={() => onClose?.()}
        fuss={mode === 'settings' && isEnabled ? (
          <Knopf variante="gefahr" voll icon={Unlock} onClick={handleDisablePin}>
            <span>{tx('PIN-Schutz Deaktivieren', 'Disable screen lock')}</span>
          </Knopf>
        ) : undefined}
      >
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-2 text-brand-red text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-brand-green text-xs font-bold">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode !== 'unlock' && (
          <p className="text-xs leading-relaxed text-slate-600">
            {tx('Schützt die App vor neugierigen Blicken. Die Flugdaten selbst werden dadurch nicht verschlüsselt – für echten Schutz die Gerätesperre des Handys nutzen.', 'Protects the app from prying eyes. The flight data itself is not encrypted – for real protection use your phone\'s device lock.')}
          </p>
        )}

        {/* PIN Indicators */}
        <div className="flex items-center justify-center gap-4 py-3">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < currentVal.length
                  ? 'bg-brand-blue border-brand-blue scale-110'
                  : 'border-slate-300 bg-slate-100'
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto pb-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(btn => (
            <button
              key={btn}
              type="button"
              onClick={() => {
                if (btn === 'C') {
                  setPinInput('');
                  setConfirmPin('');
                  setStep('enter');
                } else if (btn === '⌫') {
                  handleDeleteDigit();
                } else {
                  handleDigit(btn);
                }
              }}
              className={`h-14 rounded-xl border font-bold text-xl flex items-center justify-center transition-all active:scale-95 ${
                btn === 'C' || btn === '⌫'
                  ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  : 'bg-white border-slate-200 text-slate-900 shadow-sm hover:bg-slate-50'
              }`}
            >
              {btn}
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
