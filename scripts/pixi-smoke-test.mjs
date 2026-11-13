import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4173;
const url = `http://127.0.0.1:${port}`;
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite s'est arrêté.\n${serverOutput}`);
    try {
      const response = await fetch(url);
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(500);
  }
  if (!ready) throw new Error(`Vite n'a pas démarré.\n${serverOutput}`);

  browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--enable-webgpu-developer-features',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('#status').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => document.querySelector('#status')?.textContent?.includes('Lykos est prêt'),
    { timeout: 30000 },
  );

  const canvas = page.locator('#canvas-host canvas');
  await canvas.waitFor({ state: 'visible' });
  const dimensions = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, pixelWidth: element.width, pixelHeight: element.height };
  });
  if (dimensions.width <= 0 || dimensions.height <= 0 || dimensions.pixelWidth <= 0 || dimensions.pixelHeight <= 0) {
    throw new Error(`Canvas sans dimensions valides : ${JSON.stringify(dimensions)}`);
  }

  for (const [clip, expected] of [['Walk', 'marche'], ['Run', 'course'], ['Idle', 'observe']]) {
    await page.locator(`[data-clip="${clip}"]`).click();
    await page.waitForFunction(
      (text) => document.querySelector('#status')?.textContent?.includes(text),
      expected,
    );
  }

  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/lykos-pixi.png', fullPage: true });
  if (runtimeErrors.length) throw new Error(`Erreurs JavaScript / console :\n- ${runtimeErrors.join('\n- ')}`);

  console.log('TEST PIXIJS RÉUSSI');
  console.log(`Canvas : ${JSON.stringify(dimensions)}`);
  console.log('Initialisation 3D et boutons Observer / Marcher / Courir : OK');
  console.log('Capture : test-results/lykos-pixi.png');
} catch (error) {
  console.error('TEST PIXIJS ÉCHOUÉ');
  console.error(error);
  console.error(serverOutput);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
