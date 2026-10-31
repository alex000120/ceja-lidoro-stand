# IA Holográfica · Control por Gestos

Reproductor de 5 videos a pantalla completa, controlado con las manos a través de la cámara web. Usa **MediaPipe Hands** (cargado desde CDN) para detectar ambas manos en tiempo real. Es una página estática: no necesita servidor propio.

## Estructura

```
ia-holografica/
├── index.html          Estructura y modales
├── css/styles.css      Estilos (glassmorphism, cursor, transiciones)
├── js/
│   ├── app.js          Arranque, bucle rAF, flujo de la foto
│   ├── config.js       Lista de videos, perfiles y ajustes guardados
│   ├── handTracker.js  Cámara + MediaPipe Hands
│   ├── gestures.js     Postura de cada mano y motor de gestos
│   ├── cursor.js       Cursor virtual: suavizado, pinza, dwell
│   ├── overlay.js      Canvas transparente con el esqueleto
│   ├── player.js       Playlist, carrusel y transiciones
│   ├── photo.js        Cuenta regresiva, marco y descarga PNG
│   └── ui.js           Modales, ajustes y barra de transporte
└── videos/             Acá van video1.mp4 … video5.mp4
```

## Puesta en marcha

1. **Cargá los videos** en la carpeta `videos/` con estos nombres: `video1.mp4`, `video2.mp4`, `video3.mp4`, `video4.mp4` y `video5.mp4`. Conviene usar MP4 (H.264) de 1280×720 o menos, para que cargue rápido.
2. **Probalo desde un servidor**, no abriendo el archivo directamente. La cámara y los módulos no funcionan con `file://`. Por ejemplo, con `python3 -m http.server 8000` y entrando a `http://localhost:8000`.
3. **Publicá en GitHub Pages**: subí la carpeta a un repositorio y activá Pages desde *Settings → Pages* (rama `main`, carpeta raíz). Como la cámara requiere conexión segura, GitHub Pages (HTTPS) es la opción recomendada.
4. Al entrar, pulsá **Iniciar experiencia** y permití el uso de la cámara.

### Usar URLs de Pexels o Pixabay (opcional)

En `js/config.js`, completá el campo `remote` de cada video con la URL directa del archivo MP4. Se usará solo si el archivo local no existe. Revisá las condiciones de uso de cada video antes de publicarlo.

## Gestos

| Gesto | Acción |
|---|---|
| Puño cerrado (sostenido) | Reproducir / pausar |
| Palma abierta quieta | Reproducir / pausar |
| Deslizar la palma hacia la izquierda | Siguiente video |
| Deslizar la palma hacia la derecha | Video anterior |
| Pinza (pulgar + índice) con la mano dominante | Clic en el cursor, o arrastrar una barra |
| Segunda mano con palma abierta, subir / bajar | Volumen |
| Segunda mano en "L" (pulgar + índice), separar / juntar | Adelantar / retroceder |
| Corazón con ambas manos (índices extendidos, con las puntas juntas arriba y los pulgares juntos abajo) | Cuenta regresiva 3, 2, 1 y foto recuerdo |

La **mano dominante** mueve el cursor (la punta del índice, o el centro de la palma según el ajuste). Hacer clic sobre un botón también funciona si dejás el cursor quieto sobre él un momento (clic por permanencia).

## Foto recuerdo

Al hacer el gesto de corazón (o pulsando 📸 / la tecla **C**), se hace una cuenta regresiva y se genera una imagen PNG con:

- La foto del video actual con la cámara como inserto (o solo la cámara, según el ajuste).
- El texto **"¡Gracias por visitar nuestro stand!"**.
- La marca **CEJA LIDORO QUINTEROS · SUBSEDE N°1 · LOS RALOS**.

Después se puede descargar el PNG o compartirlo (en celulares que lo permiten). El texto y la marca se editan en `PHOTO_TEXT` dentro de `js/config.js`.

## Ajustes (⚙)

- **Perfil de dispositivo**: *Automático* detecta si el equipo es potente o liviano. Bajo, Medio y Alto fijan resolución, FPS y modelo.
- **Resolución y FPS** de la cámara, y **modelo** (rápido o equilibrado).
- **Sensibilidad** de los gestos y **suavizado** del cursor.
- **Mano dominante** y **punto del cursor** (índice o palma). Con el cursor en la palma, la palma quieta deja de pausar para no interferir con el apuntado.
- **Clic por permanencia** y su tiempo.
- **Fuente de la foto** (video + cámara, o solo cámara).
- **Esqueleto de manos**, **espejo** y **mini cámara** (activar o desactivar).

Los ajustes se guardan en el navegador de ese equipo. Si la mano dominante aparece invertida, cambiá *Mano dominante* a la otra opción.

## Teclado (para pruebas o mouse)

Espacio: reproducir / pausar · ← →: video anterior / siguiente · F: pantalla completa · C: foto recuerdo · Esc: cerrar ventanas.

## Rendimiento

- El dibujo se hace con `requestAnimationFrame`, para acompañar la pantalla a 60 FPS.
- La detección se envía a MediaPipe a la cantidad de FPS del ajuste, y nunca se encolan fotogramas: si el modelo está ocupado, se descarta el fotograma.
- El cursor se suaviza en cada frame; el esqueleto se redibuja cuando llegan nuevos resultados.
- En equipos de gama baja: usá el perfil *Bajo*, o bajá la resolución a 640×480 y el FPS a 15 o 24.

## Requisitos

Navegador moderno (Chrome, Edge, Firefox o Safari reciente), cámara web y conexión a internet (para cargar MediaPipe desde CDN la primera vez).

## Créditos

Detección de manos: [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker), Google, bajo licencia Apache 2.0.
