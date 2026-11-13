import './style.css';
import { Application, Assets, Sprite } from 'pixi.js';

const host = document.querySelector<HTMLDivElement>('#canvas-host');
const status = document.querySelector<HTMLParagraphElement>('#status');
const animationButtons = document.querySelectorAll<HTMLButtonElement>('[data-clip]');

if (!host || !status) throw new Error('Éléments HTML introuvables.');
const statusElement = status;

function setStatus(message: string, state: 'loading' | 'ready' | 'error' = 'loading') {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

async function start(): Promise<void> {
  setStatus('Chargement de Lykos…');
  const app = new Application();
  await app.init({
    antialias: true,
    background: '#b8d4d9',
    resizeTo: host!,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  host!.appendChild(app.canvas);

  const texture = await Assets.load('/lykos.webp');
  const lykos = new Sprite(texture);
  lykos.anchor.set(0.5, 1);
  lykos.eventMode = 'static';
  lykos.cursor = 'grab';
  app.stage.addChild(lykos);

  const fit = () => {
    const w = app.renderer.width;
    const h = app.renderer.height;
    const scale = Math.min((w * 0.92) / texture.width, (h * 0.88) / texture.height);
    lykos.scale.set(scale);
    lykos.position.set(w / 2, h * 0.94);
  };
  fit();
  app.renderer.on('resize', fit);

  type Clip = 'Idle' | 'Walk' | 'Run';
  let clip: Clip = 'Idle';
  let elapsed = 0;
  let baseX = 0;
  let baseY = 0;
  let pointerDown = false;
  let lastPointerX = 0;
  let dragRotation = 0;

  const play = (name: string) => {
    if (name !== 'Idle' && name !== 'Walk' && name !== 'Run') return;
    clip = name;
    animationButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.clip === name);
    });
    setStatus('Lykos · ' + ({ Idle: 'observe', Walk: 'marche', Run: 'course' }[name]), 'ready');
  };

  animationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.clip) play(button.dataset.clip);
    });
  });

  // L'illustration est conservée intacte : l'animation agit sur le sprite entier.
  // Les mouvements indépendants des membres nécessiteront une version découpée en couches.
  app.canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    lastPointerX = event.clientX;
    app.canvas.setPointerCapture(event.pointerId);
    app.canvas.style.cursor = 'grabbing';
  });
  app.canvas.addEventListener('pointermove', (event) => {
    if (!pointerDown) return;
    dragRotation += (event.clientX - lastPointerX) * 0.0015;
    lastPointerX = event.clientX;
  });
  const release = () => {
    pointerDown = false;
    app.canvas.style.cursor = 'grab';
  };
  app.canvas.addEventListener('pointerup', release);
  app.canvas.addEventListener('pointercancel', release);
  app.canvas.addEventListener('lostpointercapture', release);

  app.ticker.add((ticker) => {
    elapsed += ticker.deltaMS / 1000;
    const wave = Math.sin(elapsed * (clip === 'Run' ? 12 : clip === 'Walk' ? 7 : 1.8));
    const bounce = clip === 'Run' ? 0.024 : clip === 'Walk' ? 0.012 : 0.004;
    const sway = clip === 'Run' ? 0.045 : clip === 'Walk' ? 0.025 : 0.008;
    const stride = clip === 'Run' ? 0.018 : clip === 'Walk' ? 0.009 : 0;
    baseX = app.renderer.width / 2;
    baseY = app.renderer.height * 0.94;
    lykos.position.x = baseX + (clip === 'Idle' ? Math.sin(elapsed * 0.55) * 2 : Math.sin(elapsed * 3) * app.renderer.width * stride);
    lykos.position.y = baseY - Math.abs(wave) * app.renderer.height * bounce;
    lykos.rotation = Math.sin(elapsed * (clip === 'Idle' ? 0.7 : 4)) * sway + dragRotation;
    const breathing = clip === 'Idle' ? 1 + Math.sin(elapsed * 1.7) * 0.004 : 1;
    const pulse = clip === 'Run' ? 1 + Math.abs(wave) * 0.008 : 1;
    const s = Math.min((app.renderer.width * 0.92) / texture.width, (app.renderer.height * 0.88) / texture.height);
    lykos.scale.set(s * breathing * pulse, s * (2 - breathing * pulse));
  });

  play('Idle');
  setStatus('Lykos est prêt · fais glisser pour le faire pivoter.', 'ready');
}

start().catch((error: unknown) => {
  console.error(error);
  setStatus('Impossible de charger Lykos. Consulte la console pour le détail.', 'error');
});
