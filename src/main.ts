import './style.css';

import { Application } from 'pixi.js';
import {
  Container3D,
  DirectionalLight,
  Material3D,
  Mesh3D,
  SphereGeometry,
  View3D,
} from '@pixi/3d';
import { OrbitCamera } from '@pixi/3d/extras';

const host = document.querySelector<HTMLDivElement>('#canvas-host');
const status = document.querySelector<HTMLParagraphElement>('#status');
const animationButtons = document.querySelectorAll<HTMLButtonElement>('[data-clip]');

if (!host || !status) throw new Error('Éléments HTML introuvables.');
const statusElement = status;

function setStatus(message: string, state: 'loading' | 'ready' | 'error' = 'loading') {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

type Part = {
  node: Container3D;
  baseRotationX: number;
  baseRotationZ: number;
};

function makeLykos() {
  const root = new Container3D();
  const orange = new Material3D({ baseColor: 0xd97835, roughness: 0.92 });
  const cream = new Material3D({ baseColor: 0xf5dfb8, roughness: 1 });
  const dark = new Material3D({ baseColor: 0x493126, roughness: 0.85 });
  const blue = new Material3D({ baseColor: 0x55bde8, roughness: 0.45 });
  const black = new Material3D({ baseColor: 0x211d22, roughness: 0.55 });
  const green = new Material3D({ baseColor: 0x4f8054, roughness: 0.95 });
  const gold = new Material3D({ baseColor: 0xd9ad55, roughness: 0.7 });

  const sphere = new SphereGeometry({ radius: 1, widthSegments: 24, heightSegments: 16 });

  function part(
    parent: Container3D,
    material: Material3D,
    position: [number, number, number],
    scale: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ): Mesh3D {
    const mesh = new Mesh3D({ geometry: sphere, material });
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    parent.addChild(mesh);
    return mesh;
  }

  // Corps et ventre
  part(root, orange, [0, 0.78, 0], [0.52, 0.6, 0.72]);
  part(root, cream, [0, 0.58, 0.57], [0.34, 0.34, 0.25]);

  // Poitrine et tête
  part(root, cream, [0, 1.02, 0.58], [0.3, 0.38, 0.22]);
  const head = new Container3D();
  head.position.set(0, 1.52, 0.48);
  head.scale.set(1.08, 1.08, 1.08);
  root.addChild(head);
  part(head, orange, [0, 0.12, 0], [0.43, 0.42, 0.4]);
  part(head, cream, [0, -0.08, 0.31], [0.29, 0.2, 0.22]);
  part(head, cream, [0, -0.18, 0.43], [0.2, 0.12, 0.16]);
  // Petite flamme ivoire sur le front et joues qui adoucissent le museau
  part(head, cream, [0, 0.34, 0.365], [0.075, 0.14, 0.055]);
  for (const side of [-1, 1]) {
    part(head, cream, [side * 0.19, -0.105, 0.36], [0.12, 0.105, 0.105]);
  }
  part(head, black, [0, -0.12, 0.57], [0.075, 0.06, 0.07]);

  // Yeux bleus, pupilles et reflets
  for (const side of [-1, 1]) {
    part(head, cream, [side * 0.2, 0.17, 0.325], [0.12, 0.15, 0.09]);
    part(head, blue, [side * 0.2, 0.17, 0.402], [0.073, 0.095, 0.045]);
    part(head, black, [side * 0.2, 0.17, 0.438], [0.033, 0.065, 0.025]);
    part(head, cream, [side * 0.22 - 0.018, 0.205, 0.46], [0.018, 0.022, 0.012]);

    // Oreilles dressées
    part(head, orange, [side * 0.27, 0.54, -0.015], [0.135, 0.37, 0.115], [0, 0, side * -0.23]);
    part(head, dark, [side * 0.27, 0.56, 0.09], [0.065, 0.245, 0.035], [0, 0, side * -0.23]);
  }

  // Pattes articulées
  const legs: Part[] = [];
  for (const x of [-0.29, 0.29]) {
    for (const z of [-0.43, 0.48]) {
      const leg = new Container3D();
      leg.position.set(x, 0.58, z);
      root.addChild(leg);
      part(leg, orange, [0, -0.2, 0], [0.14, 0.34, 0.15]);
      part(leg, cream, [0, -0.42, 0.045], [0.145, 0.11, 0.19]);
      legs.push({ node: leg, baseRotationX: 0, baseRotationZ: 0 });
    }
  }

  // Queue touffue, en plusieurs volumes pour une silhouette plus douce
  const tail = new Container3D();
  tail.position.set(-0.42, 0.98, -0.3);
  tail.scale.set(1.3, 1.22, 1.25);
  tail.rotation.set(-0.28, -0.82, -0.12);
  root.addChild(tail);
  part(tail, orange, [0, 0.02, -0.28], [0.3, 0.31, 0.48], [-0.42, 0, 0]);
  part(tail, orange, [0, 0.16, -0.58], [0.28, 0.27, 0.4], [-0.48, 0, 0]);
  part(tail, orange, [0, 0.27, -0.82], [0.23, 0.23, 0.3], [-0.5, 0, 0]);
  part(tail, cream, [0, 0.38, -1.02], [0.19, 0.19, 0.23], [-0.5, 0, 0]);

  // Sacoche de voyage décalée vers le flanc visible depuis la caméra
  part(root, green, [0.42, 0.91, 0.34], [0.2, 0.23, 0.14], [0, 0, -0.12]);
  part(root, gold, [0.47, 0.91, 0.475], [0.06, 0.07, 0.035]);
  part(root, dark, [0.42, 1.12, 0.34], [0.205, 0.04, 0.145]);
  part(root, gold, [0.34, 1.08, 0.39], [0.035, 0.17, 0.035], [0, 0, -0.42]);

  return { root, head, tail, legs };
}

async function start(): Promise<void> {
  const app = new Application();
  await app.init({
    preference: 'webgl',
    antialias: true,
    background: '#b8d4d9',
    resizeTo: host!,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  host!.appendChild(app.canvas);

  const view = new View3D({
    autoResize: true,
    background: 0xb8d4d9,
    environment: { skyColor: 0xc5e3f2, groundColor: 0x617b62, intensity: 0.8 },
  });
  app.stage.addChild(view);

  const sun = new DirectionalLight({ intensity: 3, color: 0xfff1dc });
  sun.position.set(-3, 5, 4);
  sun.lookAt({ x: 0, y: 0.7, z: 0 });
  view.root.addChild(sun);

  view.camera.position.set(1.85, 1.55, 3.65);
  // Une caméra 3D doit viser explicitement le compagnon : sa position seule
  // ne garantit pas qu'elle regarde le centre de la scène.
  view.camera.lookAt({ x: 0, y: 1.08, z: 0 });
  new OrbitCamera({
    view,
    target: { x: 0, y: 1.08, z: 0 },
    enableDamping: true,
    minDistance: 2.2,
    maxDistance: 8,
  });

  setStatus('Construction du compagnon…');
  const lykos = makeLykos();
  lykos.root.scale.set(1.28, 1.28, 1.28);
  view.root.addChild(lykos.root);

  type AnimationName = 'Idle' | 'Walk' | 'Run';
  let currentAnimation: AnimationName = 'Idle';
  let elapsed = 0;

  function playClip(name: string) {
    if (name !== 'Idle' && name !== 'Walk' && name !== 'Run') return;
    currentAnimation = name;
    animationButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.clip === name);
    });
    setStatus('Lykos · ' + ({ Idle: 'observe', Walk: 'marche', Run: 'course' }[name]), 'ready');
  }

  animationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.clip) playClip(button.dataset.clip);
    });
  });

  app.ticker.add((ticker) => {
    elapsed += ticker.deltaMS / 1000;
    const speed = currentAnimation === 'Run' ? 13 : currentAnimation === 'Walk' ? 7 : 2;
    const amount = currentAnimation === 'Idle' ? 0.025 : currentAnimation === 'Run' ? 0.12 : 0.07;
    const wave = Math.sin(elapsed * speed);

    lykos.root.position.y = currentAnimation === 'Idle'
      ? Math.sin(elapsed * 2) * 0.018
      : Math.abs(wave) * amount;
    lykos.root.rotation.y = currentAnimation === 'Idle'
      ? Math.sin(elapsed * 0.7) * 0.035
      : Math.sin(elapsed * speed * 0.5) * 0.035;
    lykos.head.rotation.x = currentAnimation === 'Idle'
      ? Math.sin(elapsed * 1.4) * 0.035
      : Math.sin(elapsed * speed) * 0.045;
    lykos.tail.rotation.x = -0.35 + Math.sin(elapsed * (currentAnimation === 'Run' ? 11 : 3)) * 0.16;
    lykos.tail.rotation.z = Math.sin(elapsed * 2.4) * 0.12;

    lykos.legs.forEach((leg, index) => {
      const phase = index % 2 === 0 ? 0 : Math.PI;
      const movement = currentAnimation === 'Idle' ? 0 : Math.sin(elapsed * speed + phase) * (currentAnimation === 'Run' ? 0.72 : 0.42);
      leg.node.rotation.x = movement;
    });
  });

  playClip('Idle');
  setStatus('Lykos est prêt · fais glisser pour tourner autour de lui.', 'ready');
}

start().catch((error: unknown) => {
  console.error(error);
  setStatus('Impossible de construire Lykos. Consulte la console pour le détail.', 'error');
});
