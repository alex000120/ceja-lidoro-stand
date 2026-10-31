/* =========================================================
   Configuración global: videos, perfiles y ajustes persistentes
   ========================================================= */

/**
 * Lista de videos. Colocá los archivos en /videos con los nombres
 * video1.mp4 … video5.mp4. Si querés usar una URL directa (Pexels /
 * Pixabay), completá `remote`; se usará si el archivo local no existe.
 */
export const VIDEOS = [
  {
    id: 1,
    title: 'Ciudad futurista',
    local: 'videos/video1.mp4',
    remote: '',
    grad: 'linear-gradient(135deg,#7c5cff,#22d3ee)'
  },
  {
    id: 2,
    title: 'Océano',
    local: 'videos/video2.mp4',
    remote: '',
    grad: 'linear-gradient(135deg,#0ea5e9,#2dd4bf)'
  },
  {
    id: 3,
    title: 'Bosque',
    local: 'videos/video3.mp4',
    remote: '',
    grad: 'linear-gradient(135deg,#22c55e,#84cc16)'
  },
  {
    id: 4,
    title: 'Galaxia',
    local: 'videos/video4.mp4',
    remote: '',
    grad: 'linear-gradient(135deg,#f472b6,#7c5cff)'
  },
  {
    id: 5,
    title: 'Aurora',
    local: 'videos/video5.mp4',
    remote: '',
    grad: 'linear-gradient(135deg,#f59e0b,#f472b6)'
  }
];

/** Texto y marca institucional de la foto recuerdo */
export const PHOTO_TEXT = {
  message: '¡Gracias por visitar nuestro stand!',
  brand: 'CEJA LIDORO QUINTEROS',
  sub: 'SUBSEDE N°1 · LOS RALOS'
};

/** Perfiles de rendimiento */
export const PRESETS = {
  bajo:  { resolution: '640x480',  fps: 24, complexity: 0 },
  medio: { resolution: '960x540',  fps: 30, complexity: 1 },
  alto:  { resolution: '1280x720', fps: 60, complexity: 1 }
};

/** Ajustes por defecto */
export const DEFAULTS = {
  preset: 'auto',
  resolution: '960x540',
  fps: 30,
  complexity: 1,
  sensitivity: 1.0,     // multiplicador de gestos (0.5 – 2)
  smoothing: 0.35,      // 0 = sin suavizado, 0.9 = muy suave
  dominant: 'auto',     // 'auto' | 'Right' | 'Left'
  cursorSrc: 'indice',  // 'indice' | 'palma'
  dwellOn: true,
  dwellMs: 1200,
  showSkeleton: true,
  mirror: true,
  showPip: true,
  snapSrc: 'video'      // 'video' | 'camara'
};

const STORAGE_KEY = 'iah-settings-v2';

/** Detecta el dispositivo y devuelve el perfil sugerido */
export function detectAutoPreset() {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile || cores <= 4) return 'bajo';
  if (cores >= 8) return 'alto';
  return 'medio';
}

/** Carga ajustes guardados (o los por defecto) */
export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (_) {
    saved = {};
  }
  const merged = { ...DEFAULTS, ...saved };
  // Si el usuario ya guardó resolución/FPS a mano, respetamos esos valores.
  const hasManual = saved.resolution !== undefined && saved.fps !== undefined;
  if (!hasManual) {
    const name = merged.preset === 'auto' ? detectAutoPreset() : merged.preset;
    applyPreset(merged, name);
  }
  return merged;
}

/** Guarda ajustes (ignora errores de almacenamiento privado) */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (_) { /* almacenamiento bloqueado: seguimos sin guardar */ }
}

/** Copia los valores de un perfil sobre los ajustes */
export function applyPreset(settings, name) {
  const p = PRESETS[name];
  if (!p) return settings;
  Object.assign(settings, p);
  return settings;
}

/** Parsea "960x540" → { width, height } */
export function parseResolution(str) {
  const [w, h] = String(str).split('x').map(Number);
  return { width: w || 960, height: h || 540 };
}
