import { useEffect, useState } from 'react';
import { Lock, Unlock, X, AlertCircle, Check } from 'lucide-react';
import { setPin, verifyPin, removePin, isPinEnabled, sperreRestSekunden } from '../services/pinProtection';

interface Props {
  mode: 'unlock' | 'setup' | 'settings';
  onUnlocked?: () => void;
  onClose?: () => void;
}

export function PinLockDialog({ mode, onUnlocked, onClose }: Props) {
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

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="immer-dunkel bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl text-white p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-base">
                {mode === 'unlock' ? 'SkyLog DE Entsperren' : mode === 'setup' ? 'Bildschirmsperre einrichten' : 'Bildschirmsperre (PIN)'}
              </h2>
              <p className="text-xs text-slate-400">
                {gesperrt > 0
                  ? `Gesperrt – noch ${gesperrt} s`
                  : pruefe
                    ? 'Wird geprüft …'
                    : mode === 'unlock' ? 'Gib deinen 4-stelligen PIN ein' : step === 'enter' ? 'Gib 4 Ziffern ein' : 'PIN zur Bestätigung wiederholen'}
              </p>
            </div>
          </div>
          {onClose && mode !== 'unlock' && (
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-300 text-xs">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode !== 'unlock' && (
          <p className="text-[11px] leading-relaxed text-slate-400">
            Schützt die App vor neugierigen Blicken. Die Flugdaten selbst werden dadurch
            nicht verschlüsselt – für echten Schutz die Gerätesperre des Handys nutzen.
          </p>
        )}

        {/* PIN Indicators */}
        <div className="flex items-center justify-center gap-4 py-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < currentVal.length
                  ? 'bg-sky-400 border-sky-400 shadow-lg shadow-sky-400/40 scale-110'
                  : 'border-slate-700 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(btn => (
            <button
              key={btn}
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
              className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 border border-slate-700/60 font-bold text-lg text-slate-100 flex items-center justify-center transition-all"
            >
              {btn}
            </button>
          ))}
        </div>

        {/* Settings options */}
        {mode === 'settings' && isEnabled && (
          <div className="pt-4 border-t border-slate-800 text-center">
            <button
              onClick={handleDisablePin}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all"
            >
              <Unlock className="w-4 h-4" />
              <span>PIN-Schutz Deaktivieren</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
