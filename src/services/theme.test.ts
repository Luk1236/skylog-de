// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ladeTheme, setzeTheme, toggleTheme, wendeAn } from './theme';

// jsdom-ähnliches document/localStorage stellt vitest bereit (environment).
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ladeTheme', () => {
  it('liest ein gespeichertes Theme', () => {
    localStorage.setItem('skylog_theme', 'dark');
    expect(ladeTheme()).toBe('dark');
  });
  it('ignoriert Unsinn und fällt auf System zurück', () => {
    localStorage.setItem('skylog_theme', 'lila');
    expect(['light', 'dark']).toContain(ladeTheme());
  });
});

describe('wendeAn', () => {
  it('setzt das data-theme-Attribut', () => {
    wendeAn('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    wendeAn('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('setzeTheme', () => {
  it('speichert und wendet an', () => {
    setzeTheme('dark');
    expect(localStorage.getItem('skylog_theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('toggleTheme', () => {
  it('kippt dunkel -> hell und umgekehrt', () => {
    expect(toggleTheme('dark')).toBe('light');
    expect(toggleTheme('light')).toBe('dark');
  });
  it('persistiert das Ergebnis', () => {
    toggleTheme('light');
    expect(localStorage.getItem('skylog_theme')).toBe('dark');
  });
});
