/* =========================================================
   Foto recuerdo: cuenta regresiva, captura y marco con texto
   institucional. Descarga en PNG.
   ========================================================= */
import { PHOTO_TEXT } from './config.js';

const W = 1080;
const H = 1350;
const PHOTO = { x: 60, y: 170, w: 960, h: 860, r: 40 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hasFrame = (v) => v && v.readyState >= 2 && v.videoWidth > 0;

/** Cuenta regresiva 3, 2, 1 en pantalla */
export async function runCountdown(from, { wrap, num }) {
  wrap.classList.add('show');
  for (let s = from; s >= 1; s--) {
    num.textContent = String(s);
    num.classList.remove('tick');
    void num.offsetWidth;
    num.classList.add('tick');
    await wait(1000);
  }
  num.textContent = '📸';
  num.classList.remove('tick');
  void num.offsetWidth;
  num.classList.add('tick');
  await wait(300);
  wrap.classList.remove('show');
  num.textContent = '';
}

/** Dibuja un video/cámara en un rectángulo redondeado con encuadre "cover" */
function drawCover(ctx, src, x, y, w, h, radius, mirror) {
  const sw = src.videoWidth;
  const sh = src.videoHeight;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();
  if (mirror) {
    ctx.translate(x + w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, dx, dy, dw, dh);
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Parte un texto en líneas que entren en maxWidth */
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Genera la foto recuerdo.
 * @param {{playerVideo:HTMLVideoElement, camVideo:HTMLVideoElement, source:'video'|'camara'}} opts
 * @returns {Promise<Blob>} PNG
 */
export function composePhoto({ playerVideo, camVideo, source }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ---- Fondo ----
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b1020');
  bg.addColorStop(0.5, '#1b1244');
  bg.addColorStop(1, '#062a3a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow1 = ctx.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, 700);
  glow1.addColorStop(0, 'rgba(124, 92, 255, .45)');
  glow1.addColorStop(1, 'transparent');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(W, H, 0, W, H, 800);
  glow2.addColorStop(0, 'rgba(34, 211, 238, .35)');
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Puntos decorativos
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  for (let x = 30; x < W; x += 44) {
    for (let y = 30; y < H; y += 44) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Encabezado ----
  const now = new Date();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(238,242,255,.85)';
  ctx.font = '600 30px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.fillText('IA HOLOGRÁFICA · RECUERDO', 60, 118);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(238,242,255,.6)';
  ctx.fillText(now.toLocaleDateString('es-AR'), W - 60, 118);

  // ---- Foto ----
  const usePlayer = source === 'video' && hasFrame(playerVideo);
  const useCam = hasFrame(camVideo);
  if (usePlayer) {
    drawCover(ctx, playerVideo, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, PHOTO.r, false);
  } else if (useCam) {
    drawCover(ctx, camVideo, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, PHOTO.r, true);
  }
  // Cámara como inserto circular (solo si la foto principal es del video)
  if (usePlayer && useCam) {
    const d = 280;
    const cx = PHOTO.x + PHOTO.w - d / 2 - 28;
    const cy = PHOTO.y + PHOTO.h - d / 2 - 28;
    const L = cx - d / 2; // borde izquierdo del inserto
    const T = cy - d / 2; // borde superior del inserto
    const sw = camVideo.videoWidth;
    const sh = camVideo.videoHeight;
    const s = Math.max(d / sw, d / sh);
    const dw = sw * s;
    const dh = sh * s;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(L + d, 0); // espejo (selfie), igual que en pantalla
    ctx.scale(-1, 1);
    ctx.drawImage(camVideo, L + (d - dw) / 2, T + (d - dh) / 2, dw, dh);
    ctx.restore();
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Marco brillante
  const frame = ctx.createLinearGradient(PHOTO.x, PHOTO.y, PHOTO.x + PHOTO.w, PHOTO.y + PHOTO.h);
  frame.addColorStop(0, '#7c5cff');
  frame.addColorStop(0.5, '#22d3ee');
  frame.addColorStop(1, '#f472b6');
  ctx.lineWidth = 12;
  ctx.strokeStyle = frame;
  roundRectPath(ctx, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, PHOTO.r);
  ctx.stroke();

  // ---- Mensaje ----
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 58px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  const lines = wrapLines(ctx, PHOTO_TEXT.message, W - 140);
  let y = PHOTO.y + PHOTO.h + 110;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 70;
  }

  // ---- Institución ----
  const footY = H - 118;
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 220, footY - 28);
  ctx.lineTo(W / 2 + 220, footY - 28);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 38px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.fillText(PHOTO_TEXT.brand, W / 2, footY + 20);
  ctx.fillStyle = 'rgba(238,242,255,.8)';
  ctx.font = '600 28px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.fillText(PHOTO_TEXT.sub, W / 2, footY + 66);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))), 'image/png');
  });
}

/** Nombre de archivo con fecha y hora */
export function photoFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `recuerdo-stand-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
}
