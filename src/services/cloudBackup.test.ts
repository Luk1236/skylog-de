import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAutoBackupConfig,
  saveAutoBackupConfig,
  recordBackupPerformed,
  shouldTriggerAutoBackup,
} from './cloudBackup';

const mockStorage: Record<string, string> = {};
const fakeLocalStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = fakeLocalStorage;
}

describe('cloudBackup service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('manages auto-backup config correctly', () => {
    let conf = getAutoBackupConfig();
    expect(conf.enabled).toBe(false);

    saveAutoBackupConfig(true, 3);
    conf = getAutoBackupConfig();
    expect(conf.enabled).toBe(true);
    expect(conf.intervalDays).toBe(3);
  });

  it('evaluates shouldTriggerAutoBackup correctly', () => {
    expect(shouldTriggerAutoBackup()).toBe(false);

    saveAutoBackupConfig(true, 7);
    expect(shouldTriggerAutoBackup()).toBe(true); // Never backed up

    recordBackupPerformed();
    expect(shouldTriggerAutoBackup()).toBe(false); // Just performed
  });
});
