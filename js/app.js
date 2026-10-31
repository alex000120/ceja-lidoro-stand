/* =========================================================
   App principal: une cámara, detección, gestos, cursor,
   overlay, reproductor y foto recuerdo.
   Bucle único con requestAnimationFrame (render a 60 FPS) y
   procesamiento de detección limitado por el ajuste de FPS.
   ========================================================= */
import { loadSettings, saveSettings } from './config.js';
import { HandTracker } from './handTracker.js';
import { analyzeHand, GestureEngine } from './gestures.js';
import { VirtualCursor } from './cursor.js';
import { SkeletonOverlay } from './overlay.js';
import { Player } from './player.js';
import { runCountdown, composePhoto, photoFileName } from './photo.js';
import { UI, $ } from './ui.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* ---------- Estado ---------- */
const state = {
  settings: loadSettings(),
  hands: [],
  handsDirty: true,
  cursorInput: null,
  camOn: false,
  lastSend: 0,
  detFrames: 0,
  detFpsTime: 0,
  lastHandCount: -1,
  photoBusy: false,
  blobUrl: null,
  lastBlob: null,
  throttle: {}
};

/* ---------- Componentes ---------- */
const videoEl = $('player');
const camEl = $('cam-preview');
const overlay = new SkeletonOverlay($('overlay'));
const cursor = new VirtualCursor($('cursor'), $('ripples'));

const ui = new UI({ onApply: applySettings, onReset: () => {} });

const player = new Player({
  video: videoEl,
  carousel: $('carousel'),
  onState: (s) => ui.updatePlayback(s),
  onMessage: (msg, ms) => ui.toast(msg, ms)
});

const tracker = new HandTracker(onHandResults);

const engine = new GestureEngine({
  onCursor: (c) => {
    state.cursorInput = c;
  },
  onToggle: () => {
    const wasPaused = videoEl.paused;
    player.toggle();
    ui.toast(wasPaused ? '▶ Reproduciendo' : '❚❚ Pausa', 900);
  },
  onSwipe: (dir) => {
    if (dir === 'next') {
      player.next();
      ui.toast('Siguiente video →', 1000);
    } else {
      player.prev();
      ui.toast('← Video anterior', 1000);
    }
  },
  onVolume: (delta) => {
    const pct = player.volumeBy(delta);
    ui.setVolumeVisual(videoEl.volume);
    throttleToast('vol', `🔊 Volumen ${pct}%`, 450);
  },
  onSeek: (sec) => {
    player.seekBy(sec);
    throttleToast('seek', `${sec > 0 ? '⏩' : '⏪'} ${sec > 0 ? '+' : ''}${Math.round(sec)} s`, 450);
  },
  onHeart: () => startPhotoSequence()
});

/* ---------- Utilidades ---------- */
function throttleToast(key, msg, gap) {
  const now = performance.now();
  if (now - (state.throttle[key] || 0) < gap) return;
  state.throttle[key] = now;
  ui.toast(msg, 900);
}

function friendlyError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Necesitamos permiso para usar la cámara. Habilitalo en el navegador y volvé a intentar.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No encontramos una cámara compatible con esa resolución. Probá un perfil más bajo en Ajustes.';
  }
  if (name === 'NotReadableError') {
    return 'La cámara está siendo usada por otra aplicación.';
  }
  return (err && err.message) || 'Ocurrió un error inesperado.';
}

/* ---------- Resultados de detección (callback de MediaPipe) ---------- */
function onHandResults(results) {
  const lms = results.multiHandLandmarks || [];
  const hd = results.multiHandedness || [];
  state.hands = lms.map((lm, i) => ({
    lm,
    label: (hd[i] && hd[i].label) || 'Right',
    a: analyzeHand(lm)
  }));
  state.handsDirty = true;
  state.detFrames++;

  const now = performance.now();
  engine.update(now, state.hands, state.settings);

  const count = state.hands.length;
  if (count !== state.lastHandCount) {
    state.lastHandCount = count;
    const label = count === 2 ? 'Dos manos detectadas' : count === 1 ? `Mano ${state.hands[0].label === 'Right' ? 'derecha' : 'izquierda'} detectada` : null;
    ui.setDetection(count, label);
  }
}

/* ---------- Foto recuerdo ---------- */
async function startPhotoSequence() {
  if (state.photoBusy || ui.isOpen('photo')) return;
  state.photoBusy = true;
  engine.heartEnabled = false;
  ui.toast('💖 ¡Corazón detectado!', 1200);
  try {
    await runCountdown(3, { wrap: $('countdown'), num: $('countdown-num') });
    $('stage-fx').classList.remove('flash');
    void $('stage-fx').offsetWidth;
    $('stage-fx').classList.add('flash');

    const blob = await composePhoto({
      playerVideo: videoEl,
      camVideo: camEl,
      source: state.settings.snapSrc
    });
    showPhoto(blob);
  } catch (err) {
    console.error(err);
    ui.toast('No se pudo tomar la foto', 2200);
  } finally {
    state.photoBusy = false;
    // Breve pausa antes de volver a aceptar el gesto de corazón
    setTimeout(() => { engine.heartEnabled = true; }, 1200);
  }
}

function showPhoto(blob) {
  if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
  state.lastBlob = blob;
  state.blobUrl = URL.createObjectURL(blob);
  const name = photoFileName();

  $('photo-img').src = state.blobUrl;
  const dl = $('btn-photo-download');
  dl.href = state.blobUrl;
  dl.download = name;

  const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: 'image/png' })] }));
  $('btn-photo-share').hidden = !canShare;

  ui.openModal('photo');
}

/* ---------- Cámara ---------- */
async function restartCamera() {
  try {
    await tracker.startCamera(camEl, state.settings);
    state.camOn = true;
  } catch (err) {
    state.camOn = false;
    ui.showError(friendlyError(err));
  }
}

async function startExperience() {
  const btn = $('btn-start');
  btn.disabled = true;
  btn.textContent = 'Cargando…';

  if (location.protocol === 'file:') {
    ui.showError('Abrí la app desde un servidor (por ejemplo GitHub Pages), no desde el archivo local.');
    btn.disabled = false;
    btn.textContent = 'Iniciar experiencia';
    return;
  }

  try {
    await tracker.init(state.settings);
    await tracker.startCamera(camEl, state.settings);
    state.camOn = true;
    ui.closeModal('start');
    player.transitions = false;
    await player.load(0, { autoplay: true });
    player.transitions = true;
  } catch (err) {
    console.error(err);
    ui.showError(friendlyError(err));
    btn.disabled = false;
    btn.textContent = 'Reintentar';
  }
}

/* ---------- Ajustes ---------- */
function applySettings(next) {
  const prev = state.settings;
  const camChanged = prev.resolution !== next.resolution || Number(prev.fps) !== Number(next.fps);
  const modelChanged = Number(prev.complexity) !== Number(next.complexity);

  state.settings = { ...prev, ...next };
  saveSettings(state.settings);
  cursor.setSettings(state.settings);
  ui.setPipVisible(state.settings.showPip);
  state.handsDirty = true;

  if (modelChanged && tracker.ready) tracker.setComplexity(next.complexity);
  if (camChanged && state.camOn) restartCamera();
}

/* ---------- Bucle principal (rAF) ---------- */
let lastFrame = 0;
function loop(now) {
  // Contador de detecciones por segundo
  if (now - state.detFpsTime >= 1000) {
    ui.setFps(state.detFrames);
    state.detFrames = 0;
    state.detFpsTime = now;
  }

  // Envío de fotogramas a MediaPipe, limitado por el ajuste de FPS
  const interval = 1000 / clamp(Number(state.settings.fps) || 30, 10, 60);
  if (tracker.ready && state.camOn && now - state.lastSend >= interval) {
    if (tracker.send()) state.lastSend = now;
  }

  // Cursor virtual (suavizado en cada frame de render)
  cursor.update(now, state.cursorInput);

  // Esqueleto: se redibuja solo cuando llegan resultados nuevos
  if (state.handsDirty) {
    if (state.settings.showSkeleton && state.hands.length) {
      overlay.draw(state.hands, { mirror: state.settings.mirror, frame: tracker.frameSize });
    } else {
      overlay.clear();
    }
    state.handsDirty = false;
  }

  lastFrame = now;
  requestAnimationFrame(loop);
}

/* ---------- Interacción: barras, teclado, botones ---------- */
function handleSlider(kind, ratio) {
  if (kind === 'seek') {
    player.seekRatio(ratio);
  } else if (kind === 'volume') {
    player.setVolume(ratio);
    ui.setVolumeVisual(videoEl.volume);
  }
}

document.addEventListener('iah:slider', (e) => handleSlider(e.detail.kind, e.detail.ratio));

document.querySelectorAll('[data-slider]').forEach((slider) => {
  let dragging = false;
  const at = (ev) => {
    const r = slider.getBoundingClientRect();
    return clamp((ev.clientX - r.left) / r.width, 0, 1);
  };
  slider.addEventListener('pointerdown', (ev) => {
    dragging = true;
    slider.setPointerCapture?.(ev.pointerId);
    handleSlider(slider.dataset.kind, at(ev));
  });
  slider.addEventListener('pointermove', (ev) => {
    if (dragging) handleSlider(slider.dataset.kind, at(ev));
  });
  const stop = () => { dragging = false; };
  slider.addEventListener('pointerup', stop);
  slider.addEventListener('pointercancel', stop);
});

$('btn-play').addEventListener('click', () => player.toggle());
$('btn-prev').addEventListener('click', () => player.prev());
$('btn-next').addEventListener('click', () => player.next());
$('btn-snap').addEventListener('click', () => startPhotoSequence());
$('btn-start').addEventListener('click', () => startExperience());
$('btn-photo-again').addEventListener('click', () => {
  ui.closeModal('photo');
  startPhotoSequence();
});
$('btn-photo-share').addEventListener('click', async () => {
  if (!state.lastBlob) return;
  const file = new File([state.lastBlob], photoFileName(), { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: 'Recuerdo del stand' });
  } catch (_) { /* cancelado por el usuario */ }
});
$('btn-fullscreen').addEventListener('click', toggleFullscreen);
videoEl.addEventListener('click', () => player.toggle());

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
}

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.key === 'Escape') {
    ['help', 'settings', 'photo'].forEach((id) => ui.closeModal(id));
    return;
  }
  if (ui.anyModalOpen()) return;
  if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
  else if (e.key === 'ArrowRight') player.next();
  else if (e.key === 'ArrowLeft') player.prev();
  else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  else if (e.key === 'c' || e.key === 'C') startPhotoSequence();
});

/* ---------- Inicio ---------- */
ui.fillForm(state.settings);
cursor.setSettings(state.settings);
ui.setPipVisible(state.settings.showPip);
requestAnimationFrame(loop);
