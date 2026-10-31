/* =========================================================
   Análisis de manos y motor de gestos
   - analyzeHand(): postura de una mano (puño, palma, pinza, etc.)
   - GestureEngine: convierte posturas en acciones (play, swipe,
     volumen, adelantar, corazón…)
   Todas las coordenadas son normalizadas [0..1] en la imagen.
   ========================================================= */

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Describe la postura de una mano a partir de sus 21 landmarks.
 * @param {Array<{x:number,y:number,z:number}>} lm
 */
export function analyzeHand(lm) {
  const wrist = lm[0];
  const size = dist(lm[0], lm[9]) || 1e-4; // tamaño de la mano (muñeca → base del medio)

  const fingerUp = (tip, pip) => dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.12;
  const ext = {
    thumb: dist(lm[4], lm[5]) / size > 0.62,
    index: fingerUp(8, 6),
    middle: fingerUp(12, 10),
    ring: fingerUp(16, 14),
    pinky: fingerUp(20, 18)
  };
  const count = [ext.index, ext.middle, ext.ring, ext.pinky].filter(Boolean).length;
  const pinchDist = dist(lm[4], lm[8]) / size;

  let pose = 'other';
  if (pinchDist < 0.25) pose = 'pinch';
  else if (ext.index && ext.thumb && !ext.middle && !ext.ring && !ext.pinky) pose = 'gun';
  else if (count >= 3) pose = 'open';
  else if (count <= 1 && !ext.index) pose = 'fist';
  else if (count === 1 && ext.index) pose = 'point';

  const palmIdx = [0, 5, 9, 13, 17];
  const palm = palmIdx.reduce(
    (acc, i) => ({ x: acc.x + lm[i].x / palmIdx.length, y: acc.y + lm[i].y / palmIdx.length }),
    { x: 0, y: 0 }
  );

  return {
    pose,
    ext,
    size,
    pinchDist,
    palm,
    indexTip: { x: lm[8].x, y: lm[8].y }
  };
}

/** Elige la mano dominante según el ajuste (o la más cercana a la cámara) */
function pickDominant(hands, pref) {
  if (!hands.length) return null;
  if (pref && pref !== 'auto') {
    const match = hands.find((h) => h.label === pref);
    if (match) return match;
  }
  return hands.reduce((best, h) => (h.a.size > best.a.size ? h : best));
}

export class GestureEngine {
  /**
   * @param {object} cb  callbacks: onCursor, onToggle, onSwipe, onVolume, onSeek, onHeart
   */
  constructor(cb) {
    this.cb = cb;
    this.last = 0;
    this.heartEnabled = true;
    this.reset();
  }

  reset() {
    this.fistHold = 0;
    this.fistFired = false;
    this.openStill = 0;
    this.openFired = false;
    this.prevPalm = null;
    this.swipeHist = [];
    this.lastSwipe = 0;
    this.lastToggle = 0;
    this.prevY = null;
    this.prevSpread = null;
    this.heartHold = 0;
    this.heartFired = false;
    this.lastHeart = 0;
  }

  /**
   * Se llama en cada resultado de detección.
   * @param {number} now  timestamp (ms)
   * @param {Array<{label:string, lm:Array, a:object}>} hands  manos analizadas
   * @param {object} settings
   */
  update(now, hands, settings) {
    const dt = Math.min(100, now - (this.last || now));
    this.last = now;
    const sens = Number(settings.sensitivity) || 1;
    const mirror = !!settings.mirror;

    if (!hands.length) {
      this.cb.onCursor(null);
      this.fistHold = 0;
      this.openStill = 0;
      this.heartHold = 0;
      this.heartFired = false;
      this.prevY = null;
      this.prevSpread = null;
      this.swipeHist = [];
      this.prevPalm = null;
      return;
    }

    const dom = pickDominant(hands, settings.dominant);
    const other = hands.find((h) => h !== dom) || null;

    // ---- 1. Cursor virtual ----
    const cursorPt = settings.cursorSrc === 'palma' ? dom.a.palm : dom.a.indexTip;
    const cx = mirror ? 1 - cursorPt.x : cursorPt.x;
    this.cb.onCursor({ x: cx, y: cursorPt.y, pinch: dom.a.pinchDist < 0.25 });

    // Posición de la palma en pantalla (para swipe y quietud)
    const sx = mirror ? 1 - dom.a.palm.x : dom.a.palm.x;
    const sy = dom.a.palm.y;

    // ---- 2. Swipe con palma abierta ----
    if (dom.a.pose === 'open') {
      this.swipeHist.push({ t: now, x: sx, y: sy });
      while (this.swipeHist.length && now - this.swipeHist[0].t > 450) this.swipeHist.shift();
      if (this.swipeHist.length >= 3 && now - this.lastSwipe > 900) {
        const a = this.swipeHist[0];
        const b = this.swipeHist[this.swipeHist.length - 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const threshold = 0.2 / sens;
        if (Math.abs(dx) > threshold && Math.abs(dy) < Math.abs(dx) * 0.6) {
          this.lastSwipe = now;
          this.swipeHist = [];
          // deslizar a la derecha → anterior · a la izquierda → siguiente
          this.cb.onSwipe(dx > 0 ? 'prev' : 'next');
          this.openFired = true; // el swipe no debe disparar también play/pausa
        }
      }
    } else {
      this.swipeHist = [];
    }

    // ---- 3. Play / pausa: puño mantenido ----
    if (dom.a.pose === 'fist') {
      if (!this.fistFired) {
        this.fistHold += dt;
        if (this.fistHold >= 350 && now - this.lastToggle > 1100) {
          this.fistFired = true;
          this.lastToggle = now;
          this.cb.onToggle();
        }
      }
    } else {
      this.fistHold = 0;
      this.fistFired = false;
    }

    // ---- 4. Play / pausa: palma abierta quieta ----
    // Si el cursor sigue el centro de la palma, no usamos la palma quieta para pausar
    // (evita pausar al apuntar a los botones).
    if (dom.a.pose === 'open' && settings.cursorSrc !== 'palma') {
      const moved = this.prevPalm ? Math.hypot(sx - this.prevPalm.x, sy - this.prevPalm.y) : 1;
      this.openStill = moved < 0.006 ? this.openStill + dt : 0;
      if (this.openStill >= 800 && !this.openFired && now - this.lastToggle > 1100) {
        this.openFired = true;
        this.lastToggle = now;
        this.cb.onToggle();
      }
    } else {
      this.openStill = 0;
      this.openFired = false;
    }
    this.prevPalm = { x: sx, y: sy };

    // ---- 5. Corazón con ambas manos ----
    let heartClose = false;
    if (hands.length === 2 && this.heartEnabled) {
      const [h1, h2] = hands;
      const avg = (h1.a.size + h2.a.size) / 2;
      const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) / avg;
      const indexTips = d(h1.lm[8], h2.lm[8]);
      const thumbTips = d(h1.lm[4], h2.lm[4]);
      // Índices extendidos (descarta puños) y puntas cercanas entre sí
      const shapeOk = h1.a.ext.index && h2.a.ext.index;
      heartClose = shapeOk && indexTips < 0.55 && thumbTips < 0.55;
      if (heartClose) {
        if (!this.heartFired) {
          this.heartHold += dt;
          if (this.heartHold >= 450 && now - this.lastHeart > 5000) {
            this.heartFired = true;
            this.lastHeart = now;
            this.heartHold = 0;
            this.cb.onHeart();
          }
        }
      } else {
        this.heartHold = 0;
        this.heartFired = false;
      }
    } else {
      this.heartHold = 0;
      this.heartFired = false;
    }

    // ---- 6. Volumen: segunda mano con palma abierta, subir / bajar ----
    if (other && other.a.pose === 'open' && !heartClose) {
      const oy = other.a.palm.y;
      if (this.prevY !== null) {
        const dy = oy - this.prevY;
        if (Math.abs(dy) > 0.004) this.cb.onVolume(-dy * 2.2 * sens);
      }
      this.prevY = oy;
    } else {
      this.prevY = null;
    }

    // ---- 7. Adelantar / retroceder: segunda mano en "L" (pulgar + índice) ----
    if (other && other.a.pose === 'gun' && !heartClose) {
      const spread = other.a.pinchDist;
      if (this.prevSpread !== null) {
        const ds = spread - this.prevSpread;
        if (Math.abs(ds) > 0.012) this.cb.onSeek(ds * 60 * sens);
      }
      this.prevSpread = spread;
    } else {
      this.prevSpread = null;
    }
  }
}
