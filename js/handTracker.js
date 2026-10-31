/* =========================================================
   Cámara + MediaPipe Hands (detección de ambas manos)
   ========================================================= */
import { parseResolution } from './config.js';

const MP_VERSION = '0.4.1675469240';

export class HandTracker {
  /**
   * @param {(results: any) => void} onResults  callback con los resultados de MediaPipe
   */
  constructor(onResults) {
    this.onResults = onResults;
    this.hands = null;
    this.ready = false;
    this.busy = false;
    this.stream = null;
    this.video = null;
  }

  /** Carga el modelo (una sola vez) */
  async init(settings) {
    if (typeof window.Hands === 'undefined') {
      throw new Error('No se pudo cargar MediaPipe Hands. Revisá tu conexión a internet y recargá la página.');
    }
    this.hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MP_VERSION}/${file}`
    });
    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: Number(settings.complexity),
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
      selfieMode: false // el espejo lo resolvemos nosotros, para que coincida con el overlay
    });
    this.hands.onResults((r) => this.onResults(r));
    await this.hands.initialize();
    this.ready = true;
  }

  /** Abre la cámara con la resolución pedida */
  async startCamera(videoEl, settings) {
    this.stopCamera();
    const { width, height } = parseResolution(settings.resolution);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: Number(settings.fps), max: 60 },
        facingMode: 'user'
      }
    });
    videoEl.srcObject = stream;
    videoEl.muted = true;
    await videoEl.play().catch(() => {});
    this.stream = stream;
    this.video = videoEl;
  }

  /** Ajusta la complejidad del modelo sin reiniciar la cámara */
  setComplexity(value) {
    if (this.hands) this.hands.setOptions({ modelComplexity: Number(value) });
  }

  /** Envía un fotograma al modelo (no bloquea: si está ocupado, se omite) */
  send() {
    if (!this.ready || this.busy || !this.video || this.video.readyState < 2) return false;
    this.busy = true;
    this.hands.send({ image: this.video })
      .catch((err) => console.warn('[IAH] Error de detección:', err))
      .finally(() => { this.busy = false; });
    return true;
  }

  /** Tamaño real del fotograma de cámara */
  get frameSize() {
    if (!this.video || !this.video.videoWidth) return { w: 640, h: 480 };
    return { w: this.video.videoWidth, h: this.video.videoHeight };
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
