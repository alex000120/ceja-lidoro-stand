/* =========================================================
   Reproductor: playlist de 5 videos, carrusel, transiciones
   aleatorias y controles (play, seek, volumen).
   ========================================================= */
import { VIDEOS } from './config.js';

const TX_OUT = ['tx-out-zoom', 'tx-out-slide', 'tx-out-blur', 'tx-out-iris'];
const TX_IN = {
  'tx-out-zoom': 'tx-in-from-zoom',
  'tx-out-slide': 'tx-in-from-right',
  'tx-out-blur': 'tx-in-from-blur',
  'tx-out-iris': 'tx-in-from-iris'
};
const TX_MS = 380;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export class Player {
  /**
   * @param {{video:HTMLVideoElement, carousel:HTMLElement, onState:Function, onMessage:Function}} opts
   */
  constructor({ video, carousel, onState, onMessage }) {
    this.video = video;
    this.carousel = carousel;
    this.onState = onState || (() => {});
    this.onMessage = onMessage || (() => {});
    this.index = 0;
    this.loadId = 0;
    this.lastTx = '';
    this.transitions = true;

    this.video.loop = true;          // bucle libre
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.video.volume = 0.8;

    this.renderCarousel();
    this.bindVideoEvents();
  }

  bindVideoEvents() {
    const v = this.video;
    const emit = () => this.onState(this.snapshot());
    ['play', 'pause', 'timeupdate', 'loadedmetadata', 'volumechange', 'durationchange'].forEach((ev) =>
      v.addEventListener(ev, emit)
    );
  }

  snapshot() {
    const v = this.video;
    return {
      index: this.index,
      playing: !v.paused && !v.ended,
      current: v.currentTime || 0,
      duration: isFinite(v.duration) ? v.duration : 0,
      volume: v.volume,
      muted: v.muted
    };
  }

  renderCarousel() {
    this.carousel.innerHTML = '';
    VIDEOS.forEach((v, i) => {
      const card = document.createElement('button');
      card.className = 'card';
      card.type = 'button';
      card.setAttribute('role', 'option');
      card.setAttribute('aria-label', `Video ${v.id}: ${v.title}`);
      card.dataset.clickable = '';
      card.dataset.index = String(i);
      card.style.setProperty('--grad', v.grad);
      card.innerHTML = `
        <span class="card-bg"></span>
        <span class="card-num">${String(v.id).padStart(2, '0')}</span>
        <span class="card-label">${v.title}</span>`;
      card.addEventListener('click', () => this.load(i));
      this.carousel.appendChild(card);
    });
    this.markActive();
  }

  markActive() {
    [...this.carousel.children].forEach((c, i) => {
      c.classList.toggle('active', i === this.index);
      if (i === this.index) c.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }

  /** Intenta el archivo local; si no existe, usa la URL remota (si está configurada) */
  loadSource(url) {
    return new Promise((resolve) => {
      const v = this.video;
      const onOk = () => { v.removeEventListener('error', onErr); resolve(true); };
      const onErr = () => { v.removeEventListener('loadeddata', onOk); resolve(false); };
      v.addEventListener('loadeddata', onOk, { once: true });
      v.addEventListener('error', onErr, { once: true });
      v.src = url;
      v.load();
    });
  }

  async resolveAndLoad(i) {
    const item = VIDEOS[i];
    const card = this.carousel.children[i];
    const local = await this.loadSource(item.local);
    if (local) {
      card?.classList.remove('missing');
      return true;
    }
    if (item.remote) {
      const remote = await this.loadSource(item.remote);
      if (remote) {
        card?.classList.remove('missing');
        return true;
      }
    }
    card?.classList.add('missing');
    this.onMessage(`Falta el archivo ${item.local}`, 3500);
    return false;
  }

  /** Cambia al video i con transición aleatoria */
  async load(i, { autoplay = true } = {}) {
    const n = VIDEOS.length;
    i = ((i % n) + n) % n;
    const id = ++this.loadId;
    const v = this.video;

    let tx = null;
    if (this.transitions) {
      const pool = TX_OUT.filter((t) => t !== this.lastTx);
      tx = pool[Math.floor(Math.random() * pool.length)];
      this.lastTx = tx;
      v.classList.add(tx);
      await new Promise((r) => setTimeout(r, TX_MS));
      if (id !== this.loadId) return; // llegó otra carga más reciente
    }

    this.index = i;
    this.markActive();
    await this.resolveAndLoad(i);
    if (id !== this.loadId) return;

    if (tx) {
      v.classList.remove(tx);
      v.classList.add(TX_IN[tx]);
      void v.offsetWidth; // fuerza reflow para que la entrada sea instantánea
      requestAnimationFrame(() => requestAnimationFrame(() => v.classList.remove(TX_IN[tx])));
    }

    if (autoplay) this.play();
    this.onState(this.snapshot());
  }

  next() { return this.load(this.index + 1); }
  prev() { return this.load(this.index - 1); }

  async play() {
    try {
      await this.video.play();
    } catch (_) {
      // Autoplay con sonido bloqueado: reproducimos silenciado
      this.video.muted = true;
      this.video.play().catch(() => {});
      this.onMessage('Tocá el stand para activar el sonido', 2600);
    }
    this.onState(this.snapshot());
  }

  pause() {
    this.video.pause();
    this.onState(this.snapshot());
  }

  toggle() {
    if (this.video.paused) this.play();
    else this.pause();
  }

  /** Posiciona en un porcentaje del video (0..1) */
  seekRatio(r) {
    const d = this.video.duration;
    if (!isFinite(d) || d <= 0) return;
    this.video.currentTime = clamp(r, 0, 1) * d;
  }

  /** Avanza o retrocede N segundos */
  seekBy(seconds) {
    const d = this.video.duration;
    if (!isFinite(d) || d <= 0) return;
    this.video.currentTime = clamp(this.video.currentTime + seconds, 0, d);
  }

  setVolume(v) {
    this.video.volume = clamp(v, 0, 1);
    if (v > 0) this.video.muted = false;
  }

  volumeBy(delta) {
    this.setVolume(this.video.volume + delta);
    return Math.round(this.video.volume * 100);
  }
}
