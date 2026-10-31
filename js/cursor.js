/* =========================================================
   Cursor virtual: movimiento suavizado, clic por pinza,
   arrastre de barras y clic por permanencia (dwell)
   ========================================================= */

const MARGIN = 0.08; // zona útil de la cámara (evita tener que llegar al borde exacto)

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export class VirtualCursor {
  constructor(el, rippleLayer) {
    this.el = el;
    this.rippleLayer = rippleLayer;
    this.settings = { sensitivity: 1, smoothing: 0.35, dwellOn: true, dwellMs: 1200 };
    this.x = 0;
    this.y = 0;
    this.hasPos = false;
    this.visible = false;
    this.lastInput = 0;
    this.pinching = false;
    this.dragSlider = null;
    this.hoverEl = null;
    this.hoverStart = 0;
    this.dwellFired = false;
  }

  setSettings(s) {
    Object.assign(this.settings, s);
  }

  /**
   * @param {number} now
   * @param {{x:number,y:number,pinch:boolean}|null} input  coords normalizadas de pantalla
   */
  update(now, input) {
    if (!input) {
      if (this.visible && now - this.lastInput > 350) this.hide();
      if (this.pinching) this.releasePinch();
      return;
    }
    this.lastInput = now;

    // Mapeo: zona útil → pantalla, con ganancia según sensibilidad
    const sens = clamp(Number(this.settings.sensitivity) || 1, 0.5, 2);
    let nx = clamp((input.x - MARGIN) / (1 - 2 * MARGIN), 0, 1);
    let ny = clamp((input.y - MARGIN) / (1 - 2 * MARGIN), 0, 1);
    nx = clamp(0.5 + (nx - 0.5) * sens, 0, 1);
    ny = clamp(0.5 + (ny - 0.5) * sens, 0, 1);
    const tx = nx * window.innerWidth;
    const ty = ny * window.innerHeight;

    // Suavizado (lerp): smoothing 0 = inmediato, 0.9 = muy suave
    if (!this.hasPos) {
      this.x = tx;
      this.y = ty;
      this.hasPos = true;
    } else {
      const alpha = 1 - clamp(Number(this.settings.smoothing) || 0, 0, 0.95);
      this.x += (tx - this.x) * alpha;
      this.y += (ty - this.y) * alpha;
    }

    if (!this.visible) this.show();
    this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;

    // Elemento bajo el cursor (se oculta el cursor un instante para no tapársel)
    const under = this.elementAt(this.x, this.y);

    // ---- Pinza: clic o arrastre de barra ----
    if (input.pinch && !this.pinching) {
      this.pinching = true;
      this.el.classList.add('pinching');
      const slider = under && under.closest('[data-slider]');
      if (slider) {
        this.dragSlider = slider;
        this.setSlider(slider, this.x);
      } else {
        const btn = under && under.closest('[data-clickable]');
        if (btn) this.click(btn);
        this.ripple(this.x, this.y);
      }
    } else if (input.pinch && this.pinching && this.dragSlider) {
      this.setSlider(this.dragSlider, this.x);
    } else if (!input.pinch && this.pinching) {
      this.releasePinch();
    }

    // ---- Permanencia (dwell): quedarse sobre un botón ----
    const target = under && under.closest('[data-clickable]');
    if (target !== this.hoverEl) {
      this.hoverEl = target;
      this.hoverStart = now;
      this.dwellFired = false;
      this.el.classList.toggle('hovering', !!target);
      this.el.style.setProperty('--dwell', '0%');
    }
    if (this.hoverEl && this.settings.dwellOn && !this.dwellFired && !this.pinching) {
      const p = clamp((now - this.hoverStart) / Number(this.settings.dwellMs || 1200), 0, 1);
      this.el.style.setProperty('--dwell', `${Math.round(p * 100)}%`);
      if (p >= 1) {
        this.dwellFired = true;
        this.click(this.hoverEl);
        this.ripple(this.x, this.y);
        this.el.style.setProperty('--dwell', '0%');
      }
    }
  }

  elementAt(x, y) {
    // Ocultamos el cursor para que elementFromPoint devuelva lo que hay debajo
    const prev = this.el.style.display;
    this.el.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    this.el.style.display = prev;
    return el;
  }

  click(el) {
    el.classList.add('hot');
    setTimeout(() => el.classList.remove('hot'), 220);
    el.click();
  }

  setSlider(slider, screenX) {
    const rect = slider.getBoundingClientRect();
    const ratio = clamp((screenX - rect.left) / rect.width, 0, 1);
    document.dispatchEvent(new CustomEvent('iah:slider', {
      detail: { kind: slider.dataset.kind, ratio }
    }));
  }

  releasePinch() {
    this.pinching = false;
    this.dragSlider = null;
    this.el.classList.remove('pinching');
  }

  show() {
    this.visible = true;
    this.el.classList.add('on');
  }

  hide() {
    this.visible = false;
    this.el.classList.remove('on', 'hovering');
    this.hoverEl = null;
    this.hasPos = false;
  }

  ripple(x, y) {
    if (!this.rippleLayer) return;
    const r = document.createElement('span');
    r.className = 'ripple';
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    this.rippleLayer.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }
}
