// ESLint 9 (Flat Config). Ergänzt den reinen tsc-Check um echte Lint-Regeln:
// React-Hooks-Fehler, ungenutzte Variablen, und einen gezielten Schutz gegen
// die Icon-/DOM-Global-Falle (der Profil-Crash: <Lock/> war nicht importiert
// und fiel auf window.Lock zurück).

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// lucide-Icons, die zufällig auch Browser-Globals sind. Werden sie in JSX
// benutzt, ohne importiert zu sein, greift man auf den Global zu → Absturz.
// Diese Namen daher als Global verbieten, damit der Import erzwungen wird.
const ICON_GLOBAL_FALLE = ['Lock', 'History', 'Range', 'Selection', 'Location'].map(name => ({
  name,
  message: `"${name}" sieht nach einem lucide-Icon aus — bitte aus 'lucide-react' importieren, nicht den Browser-Global nutzen.`,
}));

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'android', 'public', 'scripts', '*.config.*', 'api'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      // TS übernimmt die Undefined-Prüfung; no-undef würde nur mit Globals kollidieren.
      'no-undef': 'off',
      // Neuer JSX-Transform (React 19) braucht kein React im Scope, keine prop-types.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-undef': 'error',
      'react/no-unescaped-entities': 'off',
      // Der eigentliche Gewinn: Hook-Regeln.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Gezielter Schutz gegen die Icon-Falle.
      'no-restricted-globals': ['error', ...ICON_GLOBAL_FALLE],
      // Realistisch halten statt hunderte Fehler: als Warnung, nicht Blocker.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none',
      }],
    },
  },
);
