/* =========================================================
   Interfaz: modales, formulario de ajustes, avisos, transporte
   y estado de detección (PIP).
   ========================================================= */
import { PRESETS, saveSettings, DEFAULTS } from './config.js';

const $ = (id) => document.getElementById(id);

const FORM_KEYS = {
  preset: 'set-preset',
  resolution: 'set-res',
  fps: 'set-fps',
  complexity: 'set-complexity',
  sensitivity: 'set-sens',
  smoothing: 'set-smooth',
  dominant: 'set-dominant',
  cursorSrc: 'set-cursor-src',
  dwellMs: 'set-dwell',
  snapSrc: 'set-snap-src',
  dwellOn: 'set-dwell-on',
  showSkeleton: 'set-skeleton',
  mirror: 'set-mirror',
  showPip: 'set-pip'
};

const BOOL_KEYS = ['dwellOn', 'showSkeleton', 'mirror', 'showPip'];

export class UI {
  /**
   * @param {{onApply:Function, onReset:Function}} handlers
   */
  constructor(handlers) {
    this.h = handlers;
    this.toastTimer = null;
    this.bindModals();
    this.bindSettingsForm();
    this.bindLabels();
  }

  /* ---------- Modales ---------- */
  openModal(id) {
    $(id).classList.add('show');
  }
  closeModal(id) {
    $(id).classList.remove('show');
  }
  isOpen(id) {
    return $(id).classList.contains('show');
  }
  anyModalOpen() {
    return ['start', 'help', 'settings', 'photo'].some((id) => this.isOpen(id));
  }

  bindModals() {
    document.querySelectorAll('.modal').forEach((m) => {
      m.addEventListener('click', (e) => {
        // Cerrar al tocar el fondo (no la tarjeta)
        if (e.target === m && m.id !== 'start') m.classList.remove('show');
      });
    });
    document.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => b.closest('.modal')?.classList.remove('show'))
    );
    $('btn-help').addEventListener('click', () => this.openModal('help'));
    $('btn-settings').addEventListener('click', () => this.openModal('settings'));
  }

  /* ---------- Avisos ---------- */
  toast(message, ms = 1600) {
    const t = $('toast');
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  showError(message) {
    const box = $('error-box');
    box.innerHTML = '';
    const p = document.createElement('p');
    p.style.color = '#eef2ff';
    p.textContent = message;
    box.appendChild(p);
    box.hidden = false;
  }

  /* ---------- Formulario de ajustes ---------- */
  fillForm(s) {
    for (const [key, id] of Object.entries(FORM_KEYS)) {
      const el = $(id);
      if (BOOL_KEYS.includes(key)) el.checked = !!s[key];
      else el.value = String(s[key] ?? DEFAULTS[key]);
    }
    this.syncOutputs();
  }

  readForm() {
    const out = {};
    for (const [key, id] of Object.entries(FORM_KEYS)) {
      const el = $(id);
      if (BOOL_KEYS.includes(key)) out[key] = el.checked;
      else if (['fps', 'complexity', 'dwellMs'].includes(key)) out[key] = Number(el.value);
      else if (['sensitivity', 'smoothing'].includes(key)) out[key] = Number(el.value);
      else out[key] = el.value;
    }
    return out;
  }

  syncOutputs() {
    $('out-sens').textContent = `${Number($('set-sens').value).toFixed(1)}×`;
    $('out-smooth').textContent = `${Math.round(Number($('set-smooth').value) * 100)}%`;
    $('out-dwell').textContent = `${(Number($('set-dwell').value) / 1000).toFixed(1)} s`;
  }

  bindLabels() {
    ['set-sens', 'set-smooth', 'set-dwell'].forEach((id) =>
      $(id).addEventListener('input', () => this.syncOutputs())
    );
  }

  bindSettingsForm() {
    // Elegir un perfil rellena resolución, FPS y modelo (sin aplicar todavía)
    $('set-preset').addEventListener('change', (e) => {
      const p = PRESETS[e.target.value];
      if (!p) return;
      $('set-res').value = p.resolution;
      $('set-fps').value = String(p.fps);
      $('set-complexity').value = String(p.complexity);
    });
    $('btn-apply').addEventListener('click', () => {
      const next = this.readForm();
      this.h.onApply(next);
      this.closeModal('settings');
      this.toast('Ajustes aplicados');
    });
    $('btn-reset').addEventListener('click', () => {
      this.fillForm({ ...DEFAULTS, preset: 'auto' });
      this.toast('Valores restablecidos (pulsá Aplicar)');
      this.h.onReset && this.h.onReset();
    });
  }

  /* ---------- Transporte ---------- */
  updatePlayback(state, playerUiSetter) {
    const btn = $('btn-play');
    btn.textContent = state.playing ? '❚❚' : '▶';
    btn.setAttribute('aria-label', state.playing ? 'Pausar' : 'Reproducir');

    const pct = state.duration ? (state.current / state.duration) * 100 : 0;
    $('seek').querySelector('.slider-fill').style.width = `${pct}%`;
    $('seek').querySelector('.slider-knob').style.left = `${pct}%`;
    $('t-cur').textContent = fmt(state.current);
    $('t-dur').textContent = fmt(state.duration);

    const vol = Math.round((state.volume || 0) * 100);
    $('volume').querySelector('.slider-fill').style.width = `${vol}%`;
    $('volume').querySelector('.slider-knob').style.left = `${vol}%`;
    $('vol-icon').textContent = vol === 0 ? '🔇' : vol < 50 ? '🔉' : '🔊';
  }

  setVolumeVisual(vol) {
    const v = Math.round(vol * 100);
    $('volume').querySelector('.slider-fill').style.width = `${v}%`;
    $('volume').querySelector('.slider-knob').style.left = `${v}%`;
    $('vol-icon').textContent = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊';
  }

  /* ---------- PIP / detección ---------- */
  setDetection(handCount, labelText) {
    const dot = $('det-dot');
    const text = $('det-text');
    if (handCount > 0) {
      dot.className = 'dot dot-green';
      text.textContent = labelText || (handCount === 2 ? 'Dos manos detectadas' : 'Mano detectada');
    } else {
      dot.className = 'dot dot-red';
      text.textContent = 'Buscando manos…';
    }
  }

  setPipVisible(show) {
    $('pip').hidden = !show;
  }

  setFps(value) {
    $('fps-badge').textContent = `${value} fps`;
  }
}

function fmt(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export { $, saveSettings };
