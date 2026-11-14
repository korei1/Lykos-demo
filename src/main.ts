import './style.css';
import { Application, Assets, Container, Graphics, MeshSimple } from 'pixi.js';

const host = document.querySelector<HTMLDivElement>('#canvas-host');
const status = document.querySelector<HTMLParagraphElement>('#status');
const animationButtons = document.querySelectorAll<HTMLButtonElement>('[data-clip]');

if (!host || !status) throw new Error('Éléments HTML introuvables.');
const statusElement = status;

function setStatus(message: string, state: 'loading' | 'ready' | 'error' = 'loading') {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

type Bone = {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  angle: number;
  weight: (x: number, y: number) => number;
};

const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function gaussianWeight(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return Math.exp(-2.2 * (dx * dx + dy * dy));
}

function rotatePoint(x: number, y: number, pivotX: number, pivotY: number, angle: number) {
  const dx = x - pivotX;
  const dy = y - pivotY;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: pivotX + dx * c - dy * s,
    y: pivotY + dx * s + dy * c,
  };
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
  const width = texture.width;
  const height = texture.height;

  const shadow = new Graphics()
    .ellipse(0, 0, 42, 9)
    .fill({ color: 0x304b50, alpha: 0.2 });
  app.stage.addChild(shadow);

  // Grille subdivisée : chaque sommet reçoit l'influence de plusieurs os 2D.
  const columns = 32;
  const rows = 22;
  const baseVertices = new Float32Array((columns + 1) * (rows + 1) * 2);
  const uvs = new Float32Array(baseVertices.length);
  const indices: number[] = [];

  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const index = row * (columns + 1) + column;
      const x = (column / columns) * width;
      const y = (row / rows) * height;
      baseVertices[index * 2] = x;
      baseVertices[index * 2 + 1] = y;
      uvs[index * 2] = column / columns;
      uvs[index * 2 + 1] = row / rows;

      if (column < columns && row < rows) {
        const topLeft = index;
        const topRight = index + 1;
        const bottomLeft = index + columns + 1;
        const bottomRight = bottomLeft + 1;
        indices.push(topLeft, topRight, bottomLeft, topRight, bottomRight, bottomLeft);
      }
    }
  }

  const mesh = new MeshSimple({
    texture,
    vertices: new Float32Array(baseVertices),
    uvs,
    indices: new Uint32Array(indices),
  });
  const rig = new Container();
  mesh.position.set(-width / 2, -height);
  rig.addChild(mesh);
  app.stage.addChild(rig);

  const getBaseScale = () => Math.min(
    (app.renderer.width * 0.92) / width,
    (app.renderer.height * 0.88) / height,
  );

  const fit = () => {
    const scale = getBaseScale();
    rig.position.set(app.renderer.width / 2, app.renderer.height * 0.94);
    rig.scale.set(scale);
    shadow.position.set(app.renderer.width / 2, app.renderer.height * 0.94);
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

  const animateRig = (time: number) => {
    const walkSpeed = clip === 'Run' ? 11 : clip === 'Walk' ? 6.5 : 1.8;
    const gait = Math.sin(time * walkSpeed);
    const gait2 = Math.sin(time * walkSpeed + Math.PI);
    const moving = clip !== 'Idle';
    const amount = clip === 'Run' ? 1 : clip === 'Walk' ? 0.58 : 0.12;

    // Os virtuels : cou/tête, base de la queue, épaules et hanches.
    // Les poids sont doux pour éviter les cassures entre les zones articulées.
    const bones: Bone[] = [
      {
        x: 108, y: 78, radiusX: 48, radiusY: 52,
        angle: Math.sin(time * 1.35) * 0.035 + (moving ? -0.025 * amount : 0),
        weight: (x, y) => gaussianWeight(x, y, 105, 58, 48, 55),
      },
      {
        x: 238, y: 128, radiusX: 72, radiusY: 48,
        angle: Math.sin(time * (clip === 'Run' ? 7 : 3.1)) * (clip === 'Idle' ? 0.11 : 0.19),
        weight: (x, y) => smoothstep(205, 285, x) * gaussianWeight(x, y, 270, 130, 65, 48),
      },
      {
        x: 126, y: 151, radiusX: 38, radiusY: 53,
        angle: moving ? gait * 0.13 * amount : Math.sin(time * 1.7) * 0.012,
        weight: (x, y) => smoothstep(128, 158, y) * gaussianWeight(x, y, 124, 166, 36, 48),
      },
      {
        x: 218, y: 153, radiusX: 42, radiusY: 52,
        angle: moving ? gait2 * 0.12 * amount : Math.sin(time * 1.7 + 0.8) * 0.01,
        weight: (x, y) => smoothstep(130, 160, y) * gaussianWeight(x, y, 216, 169, 42, 48),
      },
    ];

    const vertices = mesh.vertices;
    for (let i = 0; i < baseVertices.length; i += 2) {
      const x = baseVertices[i];
      const y = baseVertices[i + 1];
      let dx = 0;
      let dy = 0;
      let totalWeight = 0;

      for (const bone of bones) {
        const weight = Math.min(1, bone.weight(x, y));
        if (weight < 0.001) continue;
        const rotated = rotatePoint(x, y, bone.x, bone.y, bone.angle);
        dx += (rotated.x - x) * weight;
        dy += (rotated.y - y) * weight;
        totalWeight += weight;
      }

      // Une légère flexion de la colonne accompagne le pas.
      const spineWeight = gaussianWeight(x, y, 190, 118, 92, 35);
      const spineFlex = moving ? Math.sin(time * walkSpeed * 0.5) * 1.8 * amount : Math.sin(time * 1.5) * 0.45;
      dx += Math.sin((x / width) * Math.PI) * spineFlex * spineWeight;
      dy += Math.cos((x / width) * Math.PI) * spineFlex * 0.45 * spineWeight;

      const blend = Math.min(1, totalWeight);
      vertices[i] = x + dx * (totalWeight > 1 ? blend / totalWeight : 1);
      vertices[i + 1] = y + dy * (totalWeight > 1 ? blend / totalWeight : 1);
    }
    mesh.vertices = vertices;
  };

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    elapsed += dt;
    const baseScale = getBaseScale();
    const speed = clip === 'Run' ? 11 : clip === 'Walk' ? 6.5 : 1.8;
    const wave = Math.sin(elapsed * speed);
    const bob = clip === 'Idle'
      ? Math.sin(elapsed * 1.6) * 1.2
      : Math.abs(wave) * app.renderer.height * (clip === 'Run' ? 0.012 : 0.006);
    const stride = clip === 'Idle' ? 0 : Math.sin(elapsed * speed * 0.5) * app.renderer.width * (clip === 'Run' ? 0.009 : 0.004);

    animateRig(elapsed);
    rig.position.set(app.renderer.width / 2 + stride, app.renderer.height * 0.94 - bob);
    currentRotation += (targetRotation - currentRotation) * Math.min(1, dt * 7);
    if (!pointerDown) targetRotation *= Math.max(0, 1 - dt * 2.5);
    rig.rotation = currentRotation;

    const airborne = Math.min(1, bob / 18);
    shadow.position.set(app.renderer.width / 2 + stride, app.renderer.height * 0.94 + 1);
    shadow.scale.set(
      Math.max(0.65, baseScale * 1.8) * (1 - airborne * 0.18),
      Math.max(0.65, baseScale * 1.8) * (1 - airborne * 0.3),
    );
    shadow.alpha = 0.2 - airborne * 0.06;
  });

  play('Idle');
  setStatus('Lykos est prêt · son squelette 2D est actif.', 'ready');
}

start().catch((error: unknown) => {
  console.error(error);
  setStatus('Impossible de charger Lykos. Consulte la console pour le détail.', 'error');
});
