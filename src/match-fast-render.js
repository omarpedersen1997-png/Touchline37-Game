import { MeshBasicMaterial, MeshLambertMaterial } from 'three';

export function usesFastMatchRender(version, revision, quality) {
  return version === 11 && revision >= 3 && quality === 'auto';
}

// Per-vertex lighting on moving figures. Static geometry uses its authored
// diffuse and vertex colours. The original materials remain in the asset cache.
export function applyFastMatchMaterials(scene, players) {
  const moving = new Set();
  for (const group of [players.home, players.away]) {
    for (const player of group) player.traverse(node => { if (node.isMesh) moving.add(node); });
  }
  const staticCache = new Map(), movingCache = new Map();
  const replace = (source, dynamic) => {
    if (!source.isMeshStandardMaterial) return source;
    const cache = dynamic ? movingCache : staticCache;
    let material = cache.get(source);
    if (material) return material;
    const options = {
      name: source.name, color: source.color, map: source.map, alphaMap: source.alphaMap,
      fog: source.fog, opacity: source.opacity, transparent: source.transparent,
      side: source.side, depthWrite: source.depthWrite, depthTest: source.depthTest,
      vertexColors: source.vertexColors, alphaTest: source.alphaTest,
      forceSinglePass: source.forceSinglePass, clippingPlanes: source.clippingPlanes,
    };
    material = dynamic ? new MeshLambertMaterial(options) : new MeshBasicMaterial(options);
    cache.set(source, material);
    return material;
  };
  scene.traverse(node => {
    if (!node.isMesh) return;
    const dynamic = moving.has(node);
    node.material = Array.isArray(node.material)
      ? node.material.map(source => replace(source, dynamic))
      : replace(node.material, dynamic);
  });
}

// Roots and hit positions are always drawn at the viewport rate. Only the
// distant skeleton evaluation is shared across multiple rendered frames.
export function takeMatchPose(data, now, priority, visible, snap, elapsed) {
  if (!visible) {
    data.fastPoseAt = null;
    return -1;
  }
  const last = data.fastPoseAt;
  if (!priority && !snap && Number.isFinite(last) && now - last < 1000 / 24) return -1;
  data.fastPoseAt = now;
  return snap || !Number.isFinite(last) ? elapsed : Math.min(.12, (now - last) / 1000);
}

export function pauseMatchPainting({ portrait, settingsOpen, help }) {
  return portrait || settingsOpen || help;
}
