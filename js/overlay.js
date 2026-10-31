/* =========================================================
   Overlay de Canvas transparente: dibuja el esqueleto de las
   manos sobre toda la pantalla, con el mismo encuadre (cover)
   que el video, para que los puntos coincidan con las manos.
   ========================================================= */

// Conexiones entre articulaciones (MediaPipe Hands)
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];
const TIPS = [4, 8, 12, 16, 20];

const COLORS = {
  Right: { line: 'rgba(34, 211, 238, .85)', point: '#22d3ee', glow: 'rgba(34, 211, 238, .9)' },
  Left:  { line: 'rgba(167, 139, 250, .85)', point: '#a78bfa', glow: 'rgba(167, 139, 250, .9)' }
};

export class SkeletonOverlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear() {
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  /**
   * @param {Array<{label:string, lm:Array}>} hands
   * @param {{mirror:boolean, frame:{w:number,h:number}}} opts
   */
  draw(hands, opts) {
    this.clear();
    if (!hands.length) return;
    const ctx = this.ctx;
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const vw = opts.frame.w || 640;
    const vh = opts.frame.h || 480;

    // Encuadre "cover": igual que el video de fondo
    const scale = Math.max(sw / vw, sh / vh);
    const ox = (sw - vw * scale) / 2;
    const oy = (sh - vh * scale) / 2;
    const toScreen = (p) => ({
      x: (opts.mirror ? 1 - p.x : p.x) * vw * scale + ox,
      y: p.y * vh * scale + oy
    });

    for (const hand of hands) {
      const col = COLORS[hand.label] || COLORS.Right;
      const pts = hand.lm.map(toScreen);

      // Líneas
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = col.line;
      ctx.beginPath();
      for (const [a, b] of CONNECTIONS) {
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
      }
      ctx.stroke();

      // Articulaciones
      ctx.fillStyle = col.point;
      for (let i = 0; i < pts.length; i++) {
        const isTip = TIPS.includes(i);
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, isTip ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Brillo en las puntas
      ctx.shadowColor = col.glow;
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      for (const t of TIPS) {
        ctx.beginPath();
        ctx.arc(pts[t].x, pts[t].y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
  }
}
