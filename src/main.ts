import './style.css';
import { Application, Assets, Graphics, Sprite } from 'pixi.js';

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

  const texture = await Assets.load('/Lykos-demo/lykos.webp');

  // Ombre douce au sol pour mieux ancrer le compagnon dans la scène.
  const shadow = new Graphics()
    .ellipse(0, 0, 42, 9)
    .fill({ color: 0x304b50, alpha: 0.2 });
  app.stage.addChild(shadow);

  const lykos = new Sprite(texture);
  lykos.anchor.set(0.5, 1);
  lykos.eventMode = 'static';
  lykos.cursor = 'grab';
  app.stage.addChild(lykos);

  const getBaseScale = () => Math.min(
    (app.renderer.width * 0.92) / texture.width,
    (app.renderer.height * 0.88) / texture.height,
  );

  const fit = () => {
    const w = app.renderer.width;
    const h = app.renderer.height;
    const scale = getBaseScale();
    lykos.scale.set(scale);
    lykos.position.set(w / 2, h * 0.94);
    shadow.position.set(w / 2, h * 0.94);
    shadow.scale.set(Math.max(0.65, scale * 1.8));
  };
  fit();
  app.renderer.on('resize', fit);

  type Clip = 'Idle' | 'Walk' | 'Run';
  let clip: Clip = 'Idle';
  let elapsed = 0;
  let pointerDown = false;
  let lastPointerX = 0;
  let targetRotation = 0;
  let currentRotation = 0;

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

  app.canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    lastPointerX = event.clientX;
    app.canvas.setPointerCapture(event.pointerId);
    app.canvas.style.cursor = 'grabbing';
  });
  app.canvas.addEventListener('pointermove', (event) => {
    if (!pointerDown) return;
    targetRotation = Math.max(-0.16, Math.min(0.16,
      targetRotation + (event.clientX - lastPointerX) * 0.0015));
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
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    elapsed += dt;

    const speed = clip === 'Run' ? 11 : clip === 'Walk' ? 6.5 : 1.7;
    const wave = Math.sin(elapsed * speed);
    const intensity = clip === 'Run' ? 1 : clip === 'Walk' ? 0.48 : 0.12;
    const baseX = app.renderer.width / 2;
    const baseY = app.renderer.height * 0.94;
    const baseScale = getBaseScale();

    // Le mouvement reste volontairement global : l'illustration d'origine est aplatie.
    const bob = clip === 'Idle'
      ? Math.sin(elapsed * 1.6) * 2.2
      : Math.abs(wave) * app.renderer.height * (clip === 'Run' ? 0.018 : 0.009);
    const stride = clip === 'Idle' ? 0 : Math.sin(elapsed * speed * 0.5) * app.renderer.width * (clip === 'Run' ? 0.012 : 0.006);
    const breathing = clip === 'Idle' ? 1 + Math.sin(elapsed * 1.45) * 0.003 : 1;
    const squash = clip === 'Idle' ? 1 : 1 + Math.abs(wave) * (clip === 'Run' ? 0.006 : 0.003);

    lykos.position.set(baseX + stride, baseY - bob);
    currentRotation += (targetRotation - currentRotation) * Math.min(1, dt * 7);
    if (!pointerDown) targetRotation *= Math.max(0, 1 - dt * 2.5);
    const gaitTilt = Math.sin(elapsed * speed) * intensity * 0.018;
    lykos.rotation = currentRotation + gaitTilt;

    lykos.scale.set(
      baseScale * breathing * squash,
      baseScale * (breathing * 2 - squash),
    );

    // L'ombre se resserre légèrement lorsque Lykos bondit.
    const airborne = Math.min(1, bob / 22);
    shadow.position.set(baseX + stride, baseY + 1);
    shadow.scale.set(
      Math.max(0.65, baseScale * 1.8) * (1 - airborne * 0.18),
      Math.max(0.65, baseScale * 1.8) * (1 - airborne * 0.32),
    );
    shadow.alpha = 0.2 - airborne * 0.07;
  });

  play('Idle');
  setStatus('Lykos est prêt · fais glisser pour le faire pivoter.', 'ready');
}

start().catch((error: unknown) => {
  console.error(error);
  setStatus('Impossible de charger Lykos. Consulte la console pour le détail.', 'error');
});
