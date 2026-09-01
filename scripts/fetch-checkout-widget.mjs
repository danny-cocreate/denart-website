/**
 * Downloads the widget-latest GitHub release from danny-cocreate/denart-custom-checkout
 * and unpacks it into public/checkout-widget/.
 *
 * Requires CHECKOUT_WIDGET_READ_TOKEN (fine-grained PAT, contents:read on that repo).
 * Fails the build if the download or unpack fails — never falls back to a committed bundle.
 *
 * Run: node scripts/fetch-checkout-widget.mjs
 */
import { spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const OWNER = 'danny-cocreate';
const REPO = 'denart-custom-checkout';
const TAG = 'widget-latest';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'checkout-widget');

function fail(message) {
  console.error(`fetch-checkout-widget: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || '').trim();
    fail(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

async function githubJson(url) {
  const token = process.env.CHECKOUT_WIDGET_READ_TOKEN;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'denart-website-build',
    },
  });
  const body = await res.text();
  if (!res.ok) {
    fail(`GET ${url} returned ${res.status}: ${body.slice(0, 500)}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    fail(`GET ${url} returned non-JSON: ${body.slice(0, 200)}`);
  }
}

async function findIndexHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isFile() && entry.name === 'index.html') return full;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = await findIndexHtml(join(dir, entry.name));
    if (nested) return nested;
  }
  return null;
}

function hashedAssetFromIndex(html) {
  const match = html.match(/assets\/[^"'?\s]+\.(?:js|css)/i);
  if (!match) return null;
  // Vite-style content hash (index-Ab12cdEf.js), not an unhashed checkout.js
  if (!/[.-][A-Za-z0-9_-]{6,}\.(?:js|css)$/i.test(match[0])) return null;
  return match[0];
}

async function main() {
  const token = process.env.CHECKOUT_WIDGET_READ_TOKEN;
  if (!token) {
    fail(
      'CHECKOUT_WIDGET_READ_TOKEN is not set. Refusing to fall back to a committed bundle.',
    );
  }

  const release = await githubJson(`${API}/releases/tags/${TAG}`);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const archive = assets.find((asset) => /\.zip$/i.test(asset.name))
    || assets.find((asset) => /\.(tar\.gz|tgz)$/i.test(asset.name));
  if (!archive) {
    const names = assets.map((asset) => asset.name).join(', ') || '(none)';
    fail(`release ${TAG} has no zip/tarball asset. Assets: ${names}`);
  }

  const tmp = await mkdtemp(join(tmpdir(), 'checkout-widget-'));
  const archivePath = join(tmp, archive.name);
  const extractDir = join(tmp, 'extracted');
  await mkdir(extractDir, { recursive: true });

  const download = await fetch(archive.url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/octet-stream',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'denart-website-build',
    },
    redirect: 'follow',
  });
  if (!download.ok || !download.body) {
    fail(`download of ${archive.name} returned ${download.status}`);
  }
  await pipeline(Readable.fromWeb(download.body), createWriteStream(archivePath));
  const archiveStat = await stat(archivePath);
  if (archiveStat.size < 64) {
    fail(`${archive.name} is empty (${archiveStat.size} bytes)`);
  }

  if (/\.zip$/i.test(archive.name)) {
    run('unzip', ['-q', archivePath, '-d', extractDir]);
  } else {
    run('tar', ['-xzf', archivePath, '-C', extractDir]);
  }

  const indexPath = await findIndexHtml(extractDir);
  if (!indexPath) {
    fail(`no index.html in ${archive.name}`);
  }
  const bundleRoot = dirname(indexPath);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  run('rsync', ['-a', '--delete', `${bundleRoot}/`, `${outDir}/`]);

  let html;
  try {
    html = await readFile(join(outDir, 'index.html'), 'utf8');
  } catch (err) {
    fail(`unpacked widget is missing index.html: ${err.message}`);
  }
  const hashed = hashedAssetFromIndex(html);
  if (!hashed) {
    fail('unpacked index.html does not reference a hashed file under assets/. Refusing to ship.');
  }

  console.log(`fetch-checkout-widget: unpacked ${TAG} (${archive.name}, ${archiveStat.size} bytes)`);
  console.log(`fetch-checkout-widget: hashed asset ${hashed}`);
}

main().catch((err) => {
  fail(err.stack || err.message || String(err));
});
