/**
 * js/utilities.js — Pure helper functions (no dependencies)
 * 
 * Provides DOM selectors, string helpers, unit conversion,
 * formatting, and other pure utilities used across the app.
 */
(function () {
  'use strict';

  // ── DOM Selectors ────────────────────────────────────────────
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const icon = id => `<svg class="icon"><use href="#${id}"/></svg>`;

  // ── Identity & Deep Clone ────────────────────────────────────
  const uid = () => Math.random().toString(36).slice(2, 9);
  const deep = v => JSON.parse(JSON.stringify(v));

  // ── HTML Escaping ────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  // ── Colour Helpers ───────────────────────────────────────────
  function shade(hex, amount) {
    const clean = (hex || '#a0a0a0').replace('#', '');
    if (clean.length !== 6) return hex;
    const n = parseInt(clean, 16),
      r = Math.max(0, Math.min(255, (n >> 16) + amount)),
      g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount)),
      b = Math.max(0, Math.min(255, (n & 255) + amount));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  // ── Unit Conversion & Formatting ─────────────────────────────
  // These functions reference `Atelier.state.project` for the
  // current measurement unit. They are safe to call after state
  // is initialised.
  function getUnit() { return Atelier.state?.project?.unit || 'ft'; }

  function gridStep() {
    const u = getUnit();
    return u === 'ft' || u === 'in' ? 2.54 : 1;
  }

  function snap(v) {
    const step = gridStep();
    return Atelier.state?.project?.snap ? Math.round(v / step) * step : v;
  }

  function formatFeetInches(cm) {
    const totalInches = Math.max(0, Math.round(cm / 2.54)),
      feet = Math.floor(totalInches / 12),
      inches = totalInches - feet * 12;
    return `${feet}′ ${inches}″`;
  }

  function displayValue(cm) {
    const u = getUnit();
    if (u === 'm') return (cm / 100).toFixed(2);
    if (u === 'ft') return formatFeetInches(cm);
    if (u === 'in') return (cm / 2.54).toFixed(1);
    return Math.round(cm).toString();
  }

  function toCm(v) {
    const raw = String(v ?? '').trim(), u = getUnit();
    if (u === 'ft') {
      const normalized = raw.replace(/[′']/g, "'").replace(/[″"]/g, '"');
      const feetMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/i);
      if (feetMatch && (normalized.includes("'") || normalized.includes('"') || /\bft\b|\bin\b/i.test(normalized))) {
        const sign = Number(feetMatch[1]) < 0 ? -1 : 1, feet = Math.abs(Number(feetMatch[1])), inches = Number(feetMatch[2] || 0);
        return sign * (feet * 12 + inches) * 2.54;
      }
      const n = Number(raw); return Number.isFinite(n) ? n * 30.48 : 0;
    }
    const n = Number(raw) || 0;
    return u === 'm' ? n * 100 : u === 'in' ? n * 2.54 : n;
  }

  function unitLabel() { return getUnit() === 'ft' ? 'ft + in' : getUnit(); }

  function areaUnitLabel() {
    const u = getUnit();
    return u === 'm' ? 'm²' : u === 'ft' ? 'ft²' : u === 'in' ? 'in²' : 'cm²';
  }

  function formatArea(cm2) {
    const u = getUnit();
    const value = u === 'm' ? cm2 / 10000 : u === 'ft' ? cm2 / (30.48 * 30.48) : u === 'in' ? cm2 / (2.54 * 2.54) : cm2;
    const digits = u === 'cm' ? 0 : u === 'in' ? 1 : 2;
    return `${value.toFixed(digits)} ${areaUnitLabel()}`;
  }

  function formatLength(cm) {
    if (getUnit() === 'ft') return formatFeetInches(cm);
    return `${displayValue(cm)} ${unitLabel()}`;
  }

  // ── Expose on global namespace ───────────────────────────────
  window.Atelier = window.Atelier || {};
  Object.assign(window.Atelier, {
    $, $$, icon, uid, deep, escapeHtml, shade,
    gridStep, snap, displayValue, toCm, unitLabel,
    areaUnitLabel, formatArea, formatLength, formatFeetInches
  });
})();
