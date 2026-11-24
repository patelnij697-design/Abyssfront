import * as THREE from 'three';
import { BasePieceState, ItemId, ToolMode, VehicleType, WeaponId } from './types';

export const PALETTE = {
  gunmetal: 0x4a5560,
  orange: 0xe8641b,
  cobalt: 0x1d4e89,
  bone: 0xe6e2d6,
  soot: 0x1b1b1f,
  obsidian: 0x0a0e14,
  cyan: 0x2ad6ff,
  amber: 0xff7a18,
  pearl: 0xdce8e4,
};

let cachedHullTex: THREE.CanvasTexture | null = null;
let cachedDeckTex: THREE.CanvasTexture | null = null;

function getHullPanelTexture(): THREE.CanvasTexture {
  if (cachedHullTex) return cachedHullTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#dde2e8';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle brushed grain
  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(0, y, 256, 1);
  }
  // Panel seam lines
  ctx.strokeStyle = 'rgba(30, 45, 60, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 248, 248);
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();

  // Corner rivets
  ctx.fillStyle = 'rgba(20, 30, 42, 0.45)';
  for (const rx of [12, 116, 140, 244]) {
    for (const ry of [12, 116, 140, 244]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedHullTex = tex;
  return tex;
}

function getDeckGridTexture(): THREE.CanvasTexture {
  if (cachedDeckTex) return cachedDeckTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#253240';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#3c4f63';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  ctx.fillStyle = '#19232d';
  for (let x = 8; x < 256; x += 32) {
    for (let y = 8; y < 256; y += 32) {
      ctx.fillRect(x, y, 16, 16);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedDeckTex = tex;
  return tex;
}

function mat(
  color: number,
  opts: {
    roughness?: number;
    metalness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
    map?: THREE.Texture;
    depthWrite?: boolean;
  } = {}
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.25,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    map: opts.map,
    depthWrite: opts.depthWrite ?? true,
  });
}

function cyanMat() {
  return mat(PALETTE.cyan, { roughness: 0.1, emissive: PALETTE.cyan, emissiveIntensity: 1.5 });
}

function addPart(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1]
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  parent.add(m);
  return m;
}

function makeWingGeometry(span: number, rootChord: number, tipChord: number, sweep: number, thick: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -rootChord * 0.5);
  s.lineTo(span, -tipChord * 0.5 + sweep);
  s.lineTo(span, tipChord * 0.5 + sweep);
  s.lineTo(0, rootChord * 0.5);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: thick * 0.35,
    bevelSize: thick * 0.35,
    bevelSegments: 2,
  });
  geo.rotateX(Math.PI / 2);
  return geo;
}

export function buildLifepod07(): THREE.Group {
  const g = new THREE.Group();
  const hullTex = getHullPanelTexture();
  const deckTex = getDeckGridTexture();

  const boneDbl = mat(PALETTE.bone, { roughness: 0.48, metalness: 0.22, map: hullTex, side: THREE.DoubleSide });
  const innerWall = mat(0x253544, { roughness: 0.55, metalness: 0.38, map: hullTex, side: THREE.DoubleSide });
  const deckMat = mat(0x9fb2c4, { roughness: 0.65, metalness: 0.45, map: deckTex });
  const gun = mat(PALETTE.gunmetal, { roughness: 0.44, metalness: 0.75 });
  const soot = mat(PALETTE.soot, { roughness: 0.85, metalness: 0.35 });
  const orange = mat(PALETTE.orange, { roughness: 0.4, metalness: 0.28 });
  const cobalt = mat(PALETTE.cobalt, { roughness: 0.42, metalness: 0.38 });
  const glass = mat(0x7be0ff, { roughness: 0.08, metalness: 0.12, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  const cyan = cyanMat();
  const amber = mat(PALETTE.amber, { roughness: 0.2, emissive: PALETTE.amber, emissiveIntensity: 1.1 });

  // Walkable interior floor deck (y = 0.28 top surface)
  addPart(g, new THREE.CylinderGeometry(2.58, 2.75, 0.34, 24), gun, [0, 0.1, 0]);
  addPart(g, new THREE.CylinderGeometry(2.3, 2.3, 0.06, 24), deckMat, [0, 0.28, 0]);
  addPart(g, new THREE.TorusGeometry(1.45, 0.045, 6, 24), orange, [0, 0.31, 0], [Math.PI / 2, 0, 0]);
  // Floor storage hatch plate
  addPart(g, new THREE.BoxGeometry(0.9, 0.04, 0.7), gun, [0, 0.32, 0.2]);
  addPart(g, new THREE.BoxGeometry(0.24, 0.05, 0.06), orange, [0, 0.33, 0.48]);

  // Stabilizer float collar & 4 seabed anchoring struts
  addPart(g, new THREE.TorusGeometry(2.74, 0.29, 12, 28), orange, [0, 0.46, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lx = Math.cos(a) * 2.4;
    const lz = Math.sin(a) * 2.4;
    addPart(g, new THREE.CylinderGeometry(0.14, 0.18, 7.5, 8), soot, [lx * 1.12, -3.4, lz * 1.12], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]);
    addPart(g, new THREE.CylinderGeometry(0.55, 0.65, 0.28, 10), gun, [lx * 1.24, -7.0, lz * 1.24]);
  }

  // Open curved cabin walls (1.75m doorway open facing +Z)
  addPart(g, new THREE.CylinderGeometry(2.48, 2.58, 2.38, 28, 1, true, 0.36, Math.PI * 2 - 0.72), boneDbl, [0, 1.44, 0]);
  addPart(g, new THREE.CylinderGeometry(2.38, 2.44, 2.24, 28, 1, true, 0.37, Math.PI * 2 - 0.74), innerWall, [0, 1.4, 0]);

  // Interior structural ribs
  for (let i = 0; i < 5; i++) {
    const a = 0.8 + i * 1.18;
    addPart(g, new THREE.BoxGeometry(0.1, 2.1, 0.14), gun, [Math.sin(a) * 2.32, 1.38, Math.cos(a) * 2.32], [0, a, 0]);
  }

  // Airlock doorway frame (+Z), beveled seal & ajar exterior hatch door + boarding platform
  addPart(g, new THREE.BoxGeometry(0.18, 2.25, 0.34), orange, [-0.88, 1.38, 2.46]);
  addPart(g, new THREE.BoxGeometry(0.18, 2.25, 0.34), orange, [0.88, 1.38, 2.46]);
  addPart(g, new THREE.BoxGeometry(1.94, 0.22, 0.4), orange, [0, 2.48, 2.46]);
  // Swung-open hatch door panel hinged on left jamb
  addPart(g, new THREE.BoxGeometry(1.45, 2.05, 0.14), gun, [-1.35, 1.35, 3.0], [0, 1.1, 0]);
  addPart(g, new THREE.CylinderGeometry(0.24, 0.24, 0.18, 14), glass, [-1.35, 1.65, 3.0], [Math.PI / 2, 0, 1.1]);
  // Exterior boarding platform, steps & grab rails
  addPart(g, new THREE.BoxGeometry(2.25, 0.18, 1.5), deckMat, [0, 0.16, 3.18]);
  addPart(g, new THREE.BoxGeometry(0.08, 0.92, 1.25), orange, [-1.04, 0.68, 3.12]);
  addPart(g, new THREE.BoxGeometry(0.08, 0.92, 1.25), orange, [1.04, 0.68, 3.12]);

  // Curved side observation windows
  addPart(g, new THREE.CylinderGeometry(2.5, 2.5, 0.72, 18, 1, true, 1.25, 0.72), glass, [0, 1.68, 0]);
  addPart(g, new THREE.CylinderGeometry(2.5, 2.5, 0.72, 18, 1, true, -1.97, 0.72), glass, [0, 1.68, 0]);

  // Domed Roof Cap & Union Cobalt Top Hatch Cupola
  addPart(g, new THREE.SphereGeometry(2.52, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), boneDbl, [0, 2.02, 0], [0, 0, 0], [1, 0.72, 1]);
  addPart(g, new THREE.CylinderGeometry(0.95, 1.1, 0.34, 16), cobalt, [0, 3.62, 0]);
  addPart(g, new THREE.TorusGeometry(0.68, 0.1, 8, 18), orange, [0, 3.82, 0], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.CylinderGeometry(0.62, 0.62, 0.08, 14), glass, [0, 3.82, 0]);

  // Interior ceiling illumination ring & overhead grab rails
  addPart(g, new THREE.TorusGeometry(1.35, 0.06, 6, 22), cyan, [0, 3.12, 0], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), orange, [-0.65, 2.85, 0.4], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), orange, [0.65, 2.85, 0.4], [Math.PI / 2, 0, 0]);

  // Buckled comms mast & beacon on roof
  addPart(g, new THREE.CylinderGeometry(0.04, 0.07, 2.1, 8), gun, [-1.05, 3.9, -0.75], [0.18, 0, 0.32]);
  addPart(g, new THREE.SphereGeometry(0.14, 10, 8), amber, [-1.35, 4.82, -0.58]);

  // Exterior scorched retro-thruster pods
  for (const sx of [-1.45, 1.45]) {
    addPart(g, new THREE.ConeGeometry(0.32, 0.65, 10), soot, [sx, 0.35, -2.15], [0.45, 0, 0]);
  }

  // Interior Equipment Stations
  // 1. Port Wall: Lifepod Fabricator (-X)
  const fabGroup = new THREE.Group();
  fabGroup.position.set(-1.92, 1.32, -0.2);
  fabGroup.rotation.y = Math.PI / 2;
  addPart(fabGroup, new THREE.BoxGeometry(1.05, 1.35, 0.34), boneDbl, [0, 0, 0]);
  addPart(fabGroup, new THREE.BoxGeometry(0.76, 0.52, 0.1), amber, [0, 0.25, 0.18]);
  addPart(fabGroup, new THREE.BoxGeometry(0.68, 0.1, 0.34), gun, [0, -0.35, 0.24]);
  addPart(fabGroup, new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6), orange, [-0.24, 0.02, 0.22], [0.4, 0, 0]);
  addPart(fabGroup, new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6), orange, [0.24, 0.02, 0.22], [0.4, 0, 0]);
  g.add(fabGroup);

  // 2. Starboard Wall: Water Reclaimer (+X)
  const waterGroup = new THREE.Group();
  waterGroup.position.set(1.92, 1.32, -0.2);
  waterGroup.rotation.y = -Math.PI / 2;
  addPart(waterGroup, new THREE.BoxGeometry(0.9, 1.45, 0.34), gun, [0, 0, 0]);
  addPart(waterGroup, new THREE.CylinderGeometry(0.22, 0.22, 0.85, 12), cyan, [-0.15, 0.12, 0.2]);
  addPart(waterGroup, new THREE.CylinderGeometry(0.14, 0.14, 0.72, 10), glass, [0.2, 0.12, 0.2]);
  addPart(waterGroup, new THREE.BoxGeometry(0.55, 0.22, 0.25), boneDbl, [0, -0.45, 0.2]);
  g.add(waterGroup);

  // 3. Aft Wall: Storage Locker, Comms Console, Medkit & Crew Jump Seat (-Z)
  addPart(g, new THREE.BoxGeometry(1.38, 1.65, 0.42), cobalt, [0.38, 1.12, -1.98]);
  addPart(g, new THREE.BoxGeometry(0.58, 0.38, 0.06), cyan, [0.38, 1.56, -1.75]);
  addPart(g, new THREE.BoxGeometry(0.45, 0.55, 0.12), mat(0xef4444, { emissive: 0x661111 }), [-0.62, 1.48, -2.02]);
  // Padded jump seat near port-aft curve
  addPart(g, new THREE.BoxGeometry(0.85, 0.12, 0.45), orange, [-1.45, 0.65, -1.25], [0, 0.7, 0]);
  addPart(g, new THREE.BoxGeometry(0.85, 0.55, 0.1), soot, [-1.58, 0.95, -1.38], [0, 0.7, 0]);
  // Interior roof-access ladder rungs
  for (let i = 0; i < 6; i++) {
    addPart(g, new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), orange, [-1.1, 0.7 + i * 0.42, -1.68], [0, 0, Math.PI / 2]);
  }

  return g;
}

export function buildRepulsMidship(): THREE.Group {
  const g = new THREE.Group();
  g.rotation.z = 0.21;
  g.rotation.y = 0.35;

  const hullTex = getHullPanelTexture();
  const gunMat = mat(PALETTE.gunmetal, { roughness: 0.6, metalness: 0.58, map: hullTex });
  const cobaltMat = mat(PALETTE.cobalt, { roughness: 0.48, metalness: 0.42 });
  const orangeMat = mat(PALETTE.orange, { roughness: 0.45, metalness: 0.3, emissive: 0x3b1300, emissiveIntensity: 0.4 });
  const sootMat = mat(PALETTE.soot, { roughness: 0.85, metalness: 0.25 });

  addPart(g, new THREE.BoxGeometry(110, 26, 48), gunMat, [0, 13, 0]);
  addPart(g, new THREE.BoxGeometry(96, 8, 20), gunMat, [0, 28, 0]);
  for (let i = -3; i <= 3; i++) {
    addPart(g, new THREE.BoxGeometry(3.2, 28, 51), sootMat, [i * 15, 13, 0]);
  }
  addPart(g, new THREE.BoxGeometry(111, 3.8, 49), cobaltMat, [0, 17, 0]);
  addPart(g, new THREE.BoxGeometry(16, 12, 50), orangeMat, [-22, 8, 0]);
  addPart(g, new THREE.BoxGeometry(18, 2, 14), gunMat, [-24, 21, 22], [0.55, 0.2, 0.3]);
  addPart(g, new THREE.BoxGeometry(18, 2, 14), sootMat, [-18, 4, 24], [-0.4, -0.1, 0.2]);
  addPart(g, new THREE.BoxGeometry(28, 16, 49), orangeMat, [30, 6, 0]);
  addPart(g, new THREE.BoxGeometry(22, 12, 50.5), sootMat, [30, 5, 0]);

  return g;
}

export function buildRepulsBow(): THREE.Group {
  const g = new THREE.Group();
  g.rotation.y = -0.35;
  g.rotation.x = 0.18;

  const hullTex = getHullPanelTexture();
  const gunMat = mat(PALETTE.gunmetal, { roughness: 0.56, metalness: 0.58, map: hullTex });
  const cobaltMat = mat(PALETTE.cobalt, { roughness: 0.45, metalness: 0.35 });
  const orangeMat = mat(PALETTE.orange, { roughness: 0.45, metalness: 0.25 });
  const glassMat = mat(0x286f8a, { roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.65 });

  addPart(g, new THREE.BoxGeometry(74, 24, 42), gunMat, [0, 10, 0]);
  addPart(g, new THREE.BoxGeometry(30, 18, 66), gunMat, [28, 12, 0]);
  addPart(g, new THREE.BoxGeometry(75, 4, 43), cobaltMat, [0, 16, 0]);
  addPart(g, new THREE.BoxGeometry(31, 4, 67), orangeMat, [28, 17, 0]);
  addPart(g, new THREE.CylinderGeometry(10, 13, 8, 12), gunMat, [18, 24, 0]);
  addPart(g, new THREE.CylinderGeometry(9.2, 9.2, 3.5, 12), glassMat, [18, 25, 0]);
  addPart(g, new THREE.TorusGeometry(6.5, 1.1, 8, 16), orangeMat, [-12, 6, 21.5]);

  return g;
}

export function buildRepulsAft(): THREE.Group {
  const g = new THREE.Group();
  g.rotation.y = 0.22;
  g.rotation.z = -0.14;

  const hullTex = getHullPanelTexture();
  const gunMat = mat(PALETTE.gunmetal, { roughness: 0.62, metalness: 0.54, map: hullTex });
  const sootMat = mat(PALETTE.soot, { roughness: 0.85, metalness: 0.3 });
  const orangeMat = mat(PALETTE.orange, { roughness: 0.45, metalness: 0.3 });
  const radMat = mat(0x4eff7a, { roughness: 0.3, metalness: 0.1, emissive: 0x22cc44, emissiveIntensity: 0.9 });

  addPart(g, new THREE.BoxGeometry(82, 30, 48), gunMat, [0, 15, 0]);
  addPart(g, new THREE.CylinderGeometry(11, 13, 46, 14), sootMat, [-28, 18, -14], [0, 0, Math.PI / 2]);
  addPart(g, new THREE.CylinderGeometry(11, 13, 42, 14), sootMat, [-38, 9, 22], [0.25, 0.35, Math.PI / 2 + 0.18]);
  addPart(g, new THREE.TorusGeometry(9, 1.2, 8, 16), orangeMat, [-50, 18, -14], [0, Math.PI / 2, 0]);
  addPart(g, new THREE.CylinderGeometry(4.5, 4.5, 22, 12), radMat, [14, 15, 0]);
  addPart(g, new THREE.BoxGeometry(10, 10, 49), orangeMat, [32, 6, 0]);

  return g;
}

export function buildSmallPodWreck(numLabel: number): THREE.Group {
  const g = new THREE.Group();
  g.rotation.z = 0.35 + (numLabel % 3) * 0.15;
  addPart(g, new THREE.SphereGeometry(1.85, 16, 12), mat(PALETTE.bone, { roughness: 0.68, metalness: 0.2, map: getHullPanelTexture() }), [0, 1.1, 0], [0, 0, 0], [1, 0.78, 0.88]);
  addPart(g, new THREE.TorusGeometry(1.5, 0.16, 8, 18), mat(PALETTE.orange, { roughness: 0.5 }), [0, 1.15, 0], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.CylinderGeometry(0.42, 0.42, 0.18, 12), mat(0x286f8a, { roughness: 0.2 }), [0, 1.35, 1.52], [Math.PI / 2, 0, 0]);
  addPart(g, new THREE.BoxGeometry(1.4, 0.4, 1.4), mat(PALETTE.soot, { roughness: 0.85 }), [0.4, 0.3, 0.3]);
  addPart(g, new THREE.CylinderGeometry(0.04, 0.06, 1.4, 6), mat(PALETTE.gunmetal), [-0.7, 2.1, -0.4], [0.2, 0, 0.5]);
  return g;
}

export function buildProbeCasing(): THREE.Group {
  const g = new THREE.Group();
  addPart(g, new THREE.CylinderGeometry(1.8, 2.2, 6.5, 12), mat(PALETTE.gunmetal, { roughness: 0.5, metalness: 0.7, map: getHullPanelTexture() }), [0, 1.8, 0], [0.4, 0.2, 0.9]);
  addPart(g, new THREE.BoxGeometry(2.6, 0.6, 2.6), mat(PALETTE.orange, { roughness: 0.45 }), [0, 2.1, 0], [0.4, 0.2, 0.9]);
  addPart(g, new THREE.TorusGeometry(1.2, 0.15, 8, 16), mat(PALETTE.cobalt, { roughness: 0.4 }), [1.8, 1.3, 0]);
  return g;
}

export function buildWaystation(): THREE.Group {
  const g = new THREE.Group();
  const obs = mat(PALETTE.obsidian, { roughness: 0.18, metalness: 0.75 });
  const pearl = mat(PALETTE.pearl, { roughness: 0.35, metalness: 0.2 });
  const cyan = cyanMat();

  addPart(g, new THREE.CylinderGeometry(14, 16, 2.2, 20), obs, [0, 1.1, 0]);
  addPart(g, new THREE.SphereGeometry(13, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), obs, [0, 1.8, 0], [0, 0, 0], [1, 0.75, 1]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addPart(g, new THREE.TorusGeometry(12.2, 0.25, 6, 20, Math.PI), cyan, [0, 2, 0], [0, a, 0]);
  }
  addPart(g, new THREE.TorusGeometry(4.2, 0.45, 8, 24), pearl, [0, 4.5, 12.6]);
  addPart(g, new THREE.TorusGeometry(2.3, 0.22, 8, 20), cyan, [0, 4.5, 12.7]);
  addPart(g, new THREE.CylinderGeometry(1.6, 0.9, 1.5, 12), pearl, [0, 2.5, 0]);
  addPart(g, new THREE.SphereGeometry(0.55, 12, 10), cyan, [0, 3.8, 0]);

  return g;
}

export function buildSentinelSpire(): THREE.Group {
  const g = new THREE.Group();
  const obs = mat(PALETTE.obsidian, { roughness: 0.16, metalness: 0.8 });
  const pearl = mat(PALETTE.pearl, { roughness: 0.35, metalness: 0.2 });
  const eye = mat(PALETTE.cyan, { roughness: 0.1, emissive: PALETTE.cyan, emissiveIntensity: 1.8 });

  addPart(g, new THREE.CylinderGeometry(1.4, 2.2, 1.5, 8), pearl, [0, 0.75, 0]);
  addPart(g, new THREE.CylinderGeometry(0.45, 1.35, 7.5, 10), obs, [0, 5, 0]);
  addPart(g, new THREE.TorusGeometry(1.3, 0.18, 8, 18), cyanMat(), [0, 6.2, 0], [Math.PI / 2, 0, 0]);
  const eyeMesh = addPart(g, new THREE.BoxGeometry(0.35, 1.5, 0.95), eye, [0, 6.8, 0]);
  eyeMesh.name = 'spireEye';
  return g;
}

export function buildHeartspireComplex(): {
  root: THREE.Group;
  custodianGroup: THREE.Group;
  custodianPetals: THREE.Mesh[];
  custodianCore: THREE.Mesh;
  echoMesh: THREE.Group;
  anchorMeshes: THREE.Mesh[];
} {
  const root = new THREE.Group();
  const obs = mat(PALETTE.obsidian, { roughness: 0.15, metalness: 0.82 });
  const pearl = mat(PALETTE.pearl, { roughness: 0.35, metalness: 0.2 });
  const cyan = mat(PALETTE.cyan, { roughness: 0.1, emissive: PALETTE.cyan, emissiveIntensity: 1.6 });

  addPart(root, new THREE.CylinderGeometry(18, 48, 280, 14), obs, [0, 140, 0]);
  for (let i = 0; i < 5; i++) {
    addPart(root, new THREE.TorusGeometry(42 - i * 5, 1.2, 8, 28), cyan, [0, 35 + i * 50, 0], [Math.PI / 2, 0.15 * i, 0]);
  }
  addPart(root, new THREE.TorusGeometry(16, 2.2, 10, 24), pearl, [0, 16, -42]);
  addPart(root, new THREE.TorusGeometry(12, 0.6, 8, 24), cyan, [0, 16, -42]);

  addPart(root, new THREE.CylinderGeometry(20, 22, 2.5, 24), obs, [0, 1.25, 0]);
  addPart(root, new THREE.CylinderGeometry(45, 45, 1.2, 32), mat(0x0c1926, { roughness: 0.6, metalness: 0.3 }), [0, 0.3, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * 28;
    const pz = Math.sin(a) * 28;
    addPart(root, new THREE.CylinderGeometry(1.8, 2.4, 16, 8), obs, [px, 8, pz]);
    addPart(root, new THREE.BoxGeometry(0.4, 14, 0.4), cyan, [px, 8, pz]);
  }

  addPart(root, new THREE.CylinderGeometry(1.8, 2.4, 2.2, 10), pearl, [0, 3.2, 10]);
  addPart(root, new THREE.OctahedronGeometry(0.8), cyan, [0, 5.2, 10]);

  const anchorMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const am = addPart(
      root,
      new THREE.CylinderGeometry(1.3, 1.8, 6.5, 8),
      mat(PALETTE.amber, { roughness: 0.25, metalness: 0.5, emissive: PALETTE.amber, emissiveIntensity: 1.1 }),
      [Math.cos(a) * 16, 5, Math.sin(a) * 16]
    );
    anchorMeshes.push(am);
  }

  const custodianGroup = new THREE.Group();
  custodianGroup.position.set(0, 14, 0);
  root.add(custodianGroup);

  const custodianCore = addPart(
    custodianGroup,
    new THREE.IcosahedronGeometry(2.6, 1),
    mat(0xffe9a8, { roughness: 0.1, metalness: 0.1, emissive: 0xffd269, emissiveIntensity: 2.2 })
  );

  const custodianPetals: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const petal = addPart(
      custodianGroup,
      new THREE.BoxGeometry(2.2, 6.5, 0.9),
      obs,
      [Math.cos(a) * 3.8, 0, Math.sin(a) * 3.8],
      [0, -a + Math.PI / 2, 0]
    );
    custodianPetals.push(petal);
  }
  addPart(custodianGroup, new THREE.TorusGeometry(5.5, 0.35, 8, 28), cyan, [0, 0, 0], [Math.PI / 2, 0, 0]);

  const echoMesh = new THREE.Group();
  echoMesh.position.set(0, 6.2, 4);
  echoMesh.visible = false;
  const echoMat = mat(0x9ce8ff, { roughness: 0.1, emissive: 0x5ed6ff, emissiveIntensity: 1.6, transparent: true, opacity: 0.72 });
  addPart(echoMesh, new THREE.CylinderGeometry(0.45, 0.6, 1.8, 10), echoMat, [0, 1.2, 0]);
  addPart(echoMesh, new THREE.SphereGeometry(0.32, 12, 10), echoMat, [0, 2.4, 0]);
  addPart(echoMesh, new THREE.TorusGeometry(0.9, 0.06, 6, 20), echoMat, [0, 0.2, 0], [Math.PI / 2, 0, 0]);
  root.add(echoMesh);

  return { root, custodianGroup, custodianPetals, custodianCore, echoMesh, anchorMeshes };
}

export function buildVehicleModel(type: VehicleType | 'tern'): THREE.Group {
  const g = new THREE.Group();
  const hullTex = getHullPanelTexture();
  const bone = mat(PALETTE.bone, { roughness: 0.38, metalness: 0.24, map: hullTex });
  const gun = mat(PALETTE.gunmetal, { roughness: 0.42, metalness: 0.82 });
  const cobalt = mat(PALETTE.cobalt, { roughness: 0.35, metalness: 0.48 });
  const orange = mat(PALETTE.orange, { roughness: 0.4, metalness: 0.28 });
  const glass = mat(0x7be0ff, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false });
  const cyan = mat(PALETTE.cyan, { roughness: 0.1, emissive: PALETTE.cyan, emissiveIntensity: 1.6 });

  if (type === 'stingray') {
    // Lathe sculpted fuselage + beveled hydro-wings + interior pilot seat + spinning twin propellers
    const hullPts = [
      new THREE.Vector2(0.01, -2.5),
      new THREE.Vector2(0.55, -2.1),
      new THREE.Vector2(0.95, -1.2),
      new THREE.Vector2(1.08, 0.0),
      new THREE.Vector2(0.88, 1.3),
      new THREE.Vector2(0.42, 2.2),
      new THREE.Vector2(0.01, 2.45),
    ];
    const hullGeo = new THREE.LatheGeometry(hullPts, 18);
    hullGeo.rotateX(Math.PI / 2);
    addPart(g, hullGeo, bone, [0, 0, 0], [0, 0, 0], [1.05, 0.68, 1]);

    // Swept extruded hydro-wings
    const wingGeo = makeWingGeometry(1.75, 1.65, 0.75, 0.65, 0.14);
    addPart(g, wingGeo, cobalt, [0.75, 0, 0.1], [0, 0, -0.08]);
    addPart(g, wingGeo, cobalt, [-0.75, 0, 0.1], [0, Math.PI, 0.08]);
    // Winglet stabilizers
    addPart(g, new THREE.BoxGeometry(0.12, 0.62, 0.85), orange, [-2.35, 0.22, 0.82], [0.22, 0, -0.25]);
    addPart(g, new THREE.BoxGeometry(0.12, 0.62, 0.85), orange, [2.35, 0.22, 0.82], [0.22, 0, 0.25]);
    // Dorsal fin
    addPart(g, new THREE.BoxGeometry(0.14, 0.82, 1.25), orange, [0, 0.72, 0.85], [-0.38, 0, 0]);

    // Interior cockpit seat & helm visible inside canopy
    addPart(g, new THREE.BoxGeometry(0.55, 0.45, 0.55), mat(PALETTE.soot), [0, 0.08, -0.65]);
    addPart(g, new THREE.BoxGeometry(0.52, 0.25, 0.35), gun, [0, 0.12, -1.25]);
    addPart(g, new THREE.BoxGeometry(0.42, 0.16, 0.04), cyan, [0, 0.25, -1.32], [-0.35, 0, 0]);
    // Bubble canopy & orange bezel
    addPart(g, new THREE.SphereGeometry(0.84, 18, 14), glass, [0, 0.32, -0.82], [0, 0, 0], [1.0, 0.76, 1.32]);
    addPart(g, new THREE.TorusGeometry(0.82, 0.07, 8, 22), orange, [0, 0.3, -0.82], [Math.PI / 2, 0, 0]);

    // Twin ducted turbine pods + rotating rotor blades
    for (const sx of [-0.68, 0.68]) {
      addPart(g, new THREE.CylinderGeometry(0.32, 0.36, 1.05, 14), gun, [sx, 0.02, 1.9], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.TorusGeometry(0.3, 0.055, 6, 16), cyan, [sx, 0.02, 2.42]);
      const rotor = new THREE.Group();
      rotor.name = 'rotor';
      rotor.position.set(sx, 0.02, 2.38);
      addPart(rotor, new THREE.BoxGeometry(0.5, 0.08, 0.04), orange, [0, 0, 0]);
      addPart(rotor, new THREE.BoxGeometry(0.08, 0.5, 0.04), orange, [0, 0, 0]);
      g.add(rotor);
    }

    // Wingtip floodlight pods
    for (const sx of [-2.22, 2.22]) {
      addPart(g, new THREE.CylinderGeometry(0.14, 0.17, 0.42, 10), gun, [sx, 0, -0.1], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.SphereGeometry(0.13, 8, 8), cyan, [sx, 0, -0.32]);
    }
  } else if (type === 'hover_skiff') {
    addPart(g, new THREE.BoxGeometry(1.92, 0.42, 3.65), orange, [0, 0.34, 0]);
    addPart(g, new THREE.ConeGeometry(0.98, 1.25, 6), bone, [0, 0.34, -2.25], [-Math.PI / 2, Math.PI / 6, 0], [1.1, 1, 0.38]);
    // Rider saddle, handlebars & illuminated console
    addPart(g, new THREE.BoxGeometry(0.68, 0.38, 1.45), mat(PALETTE.soot), [0, 0.68, 0.35]);
    addPart(g, new THREE.CylinderGeometry(0.04, 0.04, 1.15, 8), gun, [0, 1.02, -0.58], [0, 0, Math.PI / 2]);
    addPart(g, new THREE.BoxGeometry(0.42, 0.2, 0.08), cyan, [0, 1.05, -0.66], [-0.45, 0, 0]);
    addPart(g, new THREE.BoxGeometry(1.48, 0.46, 0.1), glass, [0, 1.0, -0.82], [-0.48, 0, 0]);
    addPart(g, new THREE.BoxGeometry(1.36, 0.28, 0.92), cobalt, [0, 0.66, 1.3]);
    for (const [rx, rz] of [[-0.95, -1.15], [0.95, -1.15], [-0.95, 1.15], [0.95, 1.15]]) {
      addPart(g, new THREE.CylinderGeometry(0.38, 0.42, 0.2, 14), gun, [rx, 0.14, rz]);
      const rotor = new THREE.Group();
      rotor.name = 'rotor';
      rotor.position.set(rx, 0.06, rz);
      addPart(rotor, new THREE.TorusGeometry(0.32, 0.05, 6, 14), cyan, [0, 0, 0], [Math.PI / 2, 0, 0]);
      addPart(rotor, new THREE.BoxGeometry(0.54, 0.03, 0.08), orange, [0, 0, 0]);
      g.add(rotor);
    }
  } else if (type === 'prawn') {
    // Articulated deep-sea PRAWN Exosuit
    addPart(g, new THREE.CylinderGeometry(0.98, 0.88, 1.58, 14), orange, [0, 2.35, 0]);
    addPart(g, new THREE.SphereGeometry(0.78, 16, 12), glass, [0, 2.6, -0.58]);
    addPart(g, new THREE.BoxGeometry(0.45, 0.35, 0.35), mat(PALETTE.soot), [0, 2.32, -0.25]);
    addPart(g, new THREE.BoxGeometry(1.22, 1.28, 0.68), bone, [0, 2.45, 0.85]);
    addPart(g, new THREE.CylinderGeometry(0.22, 0.28, 0.88, 10), gun, [-0.42, 2.2, 1.25], [0.2, 0, 0]);
    addPart(g, new THREE.CylinderGeometry(0.22, 0.28, 0.88, 10), gun, [0.42, 2.2, 1.25], [0.2, 0, 0]);
    addPart(g, new THREE.SphereGeometry(0.18, 8, 8), cyan, [-0.42, 1.75, 1.32]);
    addPart(g, new THREE.SphereGeometry(0.18, 8, 8), cyan, [0.42, 1.75, 1.32]);
    addPart(g, new THREE.SphereGeometry(0.14, 8, 8), cyan, [-0.82, 3.05, -0.45]);
    addPart(g, new THREE.SphereGeometry(0.14, 8, 8), cyan, [0.82, 3.05, -0.45]);
    for (const sx of [-0.72, 0.72]) {
      addPart(g, new THREE.CylinderGeometry(0.22, 0.25, 0.9, 10), gun, [sx, 1.25, 0]);
      addPart(g, new THREE.CylinderGeometry(0.26, 0.28, 0.85, 10), bone, [sx, 0.65, 0]);
      addPart(g, new THREE.BoxGeometry(0.64, 0.28, 1.05), gun, [sx, 0.14, -0.15]);
    }
    // Drill & Grabber arms
    addPart(g, new THREE.BoxGeometry(0.4, 0.4, 0.65), orange, [-1.25, 2.35, -0.1]);
    addPart(g, new THREE.CylinderGeometry(0.26, 0.34, 1.35, 10), gun, [-1.35, 2.2, -0.65], [Math.PI / 2, 0, 0]);
    const drillTip = addPart(g, new THREE.ConeGeometry(0.28, 0.88, 8), cobalt, [-1.35, 2.2, -1.68], [-Math.PI / 2, 0, 0]);
    drillTip.name = 'rotor';
    addPart(g, new THREE.BoxGeometry(0.4, 0.4, 0.65), orange, [1.25, 2.35, -0.1]);
    addPart(g, new THREE.BoxGeometry(0.32, 0.32, 1.45), gun, [1.35, 2.2, -0.65]);
    addPart(g, new THREE.TorusGeometry(0.28, 0.07, 6, 12, Math.PI * 1.45), orange, [1.35, 2.2, -1.48]);
  } else if (type === 'bulwark') {
    const darkGun = mat(0x283038, { roughness: 0.38, metalness: 0.82, map: hullTex });
    addPart(g, new THREE.CylinderGeometry(2.38, 2.48, 14.5, 18), darkGun, [0, 0, 0], [Math.PI / 2, 0, 0]);
    addPart(g, new THREE.SphereGeometry(2.42, 18, 14), darkGun, [0, 0, -7.2], [0, 0, 0], [1.05, 0.95, 0.9]);
    // Conning tower & bridge fin
    addPart(g, new THREE.BoxGeometry(1.55, 2.4, 4.3), orange, [0, 2.8, 0.8]);
    addPart(g, new THREE.BoxGeometry(5.8, 0.35, 2.4), cobalt, [0, 2.2, 0.8]);
    // Flank stabilizer dive planes
    addPart(g, new THREE.BoxGeometry(8.4, 0.45, 2.8), darkGun, [0, 0.2, -5.6]);
    addPart(g, new THREE.BoxGeometry(6.6, 0.35, 2.2), cobalt, [0, 0.2, 5.2]);
    // Panoramic dome cockpit glass + interior bridge helm
    addPart(g, new THREE.SphereGeometry(2.12, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), glass, [0, 0.2, -7.5], [-Math.PI / 2, 0, 0]);
    addPart(g, new THREE.BoxGeometry(1.85, 0.45, 0.65), cyan, [0, -0.3, -7.8]);
    addPart(g, new THREE.TorusGeometry(0.32, 0.05, 6, 12), orange, [0, 0.15, -7.7]);
    // Rear shrouded propeller turbine + rotating blades
    addPart(g, new THREE.TorusGeometry(1.78, 0.26, 8, 22), orange, [0, 0, 7.6]);
    addPart(g, new THREE.SphereGeometry(0.82, 10, 8), cyan, [0, 0, 7.6]);
    const prop = new THREE.Group();
    prop.name = 'rotor';
    prop.position.set(0, 0, 7.75);
    addPart(prop, new THREE.BoxGeometry(3.1, 0.36, 0.12), gun, [0, 0, 0]);
    addPart(prop, new THREE.BoxGeometry(0.36, 3.1, 0.12), gun, [0, 0, 0]);
    g.add(prop);
    // Underslung Maelstrom Supergun
    addPart(g, new THREE.CylinderGeometry(0.36, 0.44, 6.8, 12), darkGun, [0, -2.6, -5.2], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) {
      addPart(g, new THREE.TorusGeometry(0.52, 0.09, 8, 16), cyan, [0, -2.6, -6.2 - i * 0.95]);
    }
  } else {
    // Tern Drop Ship VTOL
    addPart(g, new THREE.BoxGeometry(4.2, 2.8, 13.5), bone, [0, 2.2, 0]);
    addPart(g, new THREE.ConeGeometry(2.0, 3.6, 8), orange, [0, 2.0, -8.3], [-Math.PI / 2, Math.PI / 4, 0]);
    addPart(g, new THREE.BoxGeometry(2.8, 0.8, 1.8), glass, [0, 3.0, -6.4], [0.35, 0, 0]);
    addPart(g, new THREE.BoxGeometry(12.2, 0.45, 2.8), cobalt, [0, 3.0, -0.5]);
    addPart(g, new THREE.BoxGeometry(4.5, 0.4, 2.0), orange, [0, 3.2, 5.8]);
    for (const [px, pz] of [[-5.4, -2.2], [5.4, -2.2], [-5.4, 2.5], [5.4, 2.5]]) {
      addPart(g, new THREE.CylinderGeometry(1.35, 1.35, 0.9, 14), mat(PALETTE.soot, { roughness: 0.7, metalness: 0.6 }), [px, 3.1, pz]);
      addPart(g, new THREE.TorusGeometry(1.12, 0.08, 6, 16), cyan, [px, 2.65, pz], [Math.PI / 2, 0, 0]);
    }
  }
  return g;
}

export function buildVehicleCockpit(type: VehicleType): THREE.Group {
  const g = new THREE.Group();
  const gun = mat(0x283542, { roughness: 0.45, metalness: 0.78 });
  const orange = mat(PALETTE.orange, { roughness: 0.42, metalness: 0.25 });
  const bone = mat(PALETTE.bone, { roughness: 0.45, metalness: 0.2 });
  const cyan = mat(PALETTE.cyan, { roughness: 0.15, emissive: PALETTE.cyan, emissiveIntensity: 1.35 });
  const amber = mat(PALETTE.amber, { roughness: 0.2, emissive: PALETTE.amber, emissiveIntensity: 1.1 });

  if (type === 'stingray') {
    // Sleek lower dashboard coaming & twin flight yokes + curved corner canopy struts
    addPart(g, new THREE.BoxGeometry(1.05, 0.18, 0.35), gun, [0, -0.34, -0.56], [0.22, 0, 0]);
    addPart(g, new THREE.BoxGeometry(0.28, 0.12, 0.03), cyan, [0, -0.26, -0.58], [-0.45, 0, 0]);
    addPart(g, new THREE.BoxGeometry(0.14, 0.08, 0.03), amber, [-0.26, -0.27, -0.57], [-0.4, 0.2, 0]);
    addPart(g, new THREE.BoxGeometry(0.14, 0.08, 0.03), cyan, [0.26, -0.27, -0.57], [-0.4, -0.2, 0]);
    // Dual grip yokes
    addPart(g, new THREE.CylinderGeometry(0.025, 0.03, 0.22, 8), orange, [-0.22, -0.24, -0.45], [0.3, 0, 0.12]);
    addPart(g, new THREE.CylinderGeometry(0.025, 0.03, 0.22, 8), orange, [0.22, -0.24, -0.45], [0.3, 0, -0.12]);
    // Upper canopy frame struts framing outer edges only
    addPart(g, new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), orange, [-0.48, 0.08, -0.52], [0.4, 0, -0.42]);
    addPart(g, new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), orange, [0.48, 0.08, -0.52], [0.4, 0, 0.42]);
  } else if (type === 'hover_skiff') {
    // Forward handlebars, speed cluster & windshield trim
    addPart(g, new THREE.CylinderGeometry(0.028, 0.028, 0.72, 10), gun, [0, -0.27, -0.48], [0, 0, Math.PI / 2]);
    addPart(g, new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), orange, [-0.3, -0.27, -0.48], [0, 0, Math.PI / 2]);
    addPart(g, new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), orange, [0.3, -0.27, -0.48], [0, 0, Math.PI / 2]);
    addPart(g, new THREE.BoxGeometry(0.24, 0.11, 0.03), cyan, [0, -0.22, -0.52], [-0.4, 0, 0]);
    addPart(g, new THREE.BoxGeometry(0.75, 0.03, 0.04), orange, [0, -0.12, -0.62]);
  } else if (type === 'prawn') {
    // Heavy PRAWN armored lower roll cage + left Drill & right Claw arms in periphery
    addPart(g, new THREE.BoxGeometry(1.15, 0.14, 0.26), orange, [0, -0.38, -0.56]);
    addPart(g, new THREE.BoxGeometry(0.24, 0.1, 0.03), cyan, [0, -0.29, -0.55], [-0.4, 0, 0]);
    addPart(g, new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8), gun, [-0.52, 0.04, -0.5], [0.2, 0, -0.2]);
    addPart(g, new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8), gun, [0.52, 0.04, -0.5], [0.2, 0, 0.2]);
    // Left Drill Arm silhouette
    addPart(g, new THREE.CylinderGeometry(0.07, 0.09, 0.34, 8), gun, [-0.46, -0.25, -0.62], [Math.PI / 2, 0, 0.12]);
    addPart(g, new THREE.ConeGeometry(0.075, 0.24, 8), cyan, [-0.48, -0.25, -0.88], [-Math.PI / 2, 0, 0.12]);
    // Right Grabber Claw silhouette
    addPart(g, new THREE.BoxGeometry(0.09, 0.09, 0.36), bone, [0.46, -0.25, -0.62], [0, -0.12, 0]);
    addPart(g, new THREE.TorusGeometry(0.075, 0.02, 6, 12, Math.PI * 1.4), orange, [0.48, -0.25, -0.86]);
  } else {
    // Bulwark panoramic bridge helm, telegraph throttles & overhead console bar
    addPart(g, new THREE.BoxGeometry(1.45, 0.22, 0.42), gun, [0, -0.36, -0.62], [0.15, 0, 0]);
    addPart(g, new THREE.TorusGeometry(0.14, 0.022, 8, 16), orange, [0, -0.24, -0.5], [0.35, 0, 0]);
    addPart(g, new THREE.BoxGeometry(0.32, 0.13, 0.03), cyan, [-0.36, -0.23, -0.58], [-0.35, 0.22, 0]);
    addPart(g, new THREE.BoxGeometry(0.32, 0.13, 0.03), amber, [0.36, -0.23, -0.58], [-0.35, -0.22, 0]);
    // Side bridge mullions
    addPart(g, new THREE.BoxGeometry(0.06, 0.95, 0.08), orange, [-0.58, 0.06, -0.65], [0, 0, -0.18]);
    addPart(g, new THREE.BoxGeometry(0.06, 0.95, 0.08), orange, [0.58, 0.06, -0.65], [0, 0, 0.18]);
    addPart(g, new THREE.BoxGeometry(1.3, 0.06, 0.1), gun, [0, 0.44, -0.64]);
  }

  return g;
}

export function buildBaseStructure(type: BasePieceState['type']): THREE.Group {
  const g = new THREE.Group();
  const hullTex = getHullPanelTexture();
  const deckTex = getDeckGridTexture();

  const bone = mat(PALETTE.bone, { roughness: 0.48, metalness: 0.22, map: hullTex });
  const boneDbl = mat(PALETTE.bone, { roughness: 0.48, metalness: 0.22, map: hullTex, side: THREE.DoubleSide });
  const innerWall = mat(0x283949, { roughness: 0.56, metalness: 0.35, map: hullTex, side: THREE.DoubleSide });
  const deckMat = mat(0x9fb2c4, { roughness: 0.65, metalness: 0.42, map: deckTex });
  const gun = mat(PALETTE.gunmetal, { roughness: 0.5, metalness: 0.7 });
  const orange = mat(PALETTE.orange, { roughness: 0.42, metalness: 0.26 });
  const cobalt = mat(PALETTE.cobalt, { roughness: 0.42, metalness: 0.38 });
  const glass = mat(0x88e6ff, { roughness: 0.08, metalness: 0.12, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  const cyan = cyanMat();
  const amber = mat(PALETTE.amber, { roughness: 0.2, emissive: PALETTE.amber, emissiveIntensity: 1.1 });

  switch (type) {
    case 'small_hab': {
      // Hollow walkable habitat with open +Z airlock doorway, interior deck, wall ribs & glass skylight dome
      addPart(g, new THREE.CylinderGeometry(3.3, 3.55, 0.48, 22), gun, [0, 0.22, 0]);
      addPart(g, new THREE.CylinderGeometry(3.0, 3.0, 0.06, 22), deckMat, [0, 0.48, 0]);
      // Corner support pilings into terrain
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        addPart(g, new THREE.CylinderGeometry(0.16, 0.22, 2.2, 8), gun, [Math.cos(a) * 3.1, -0.7, Math.sin(a) * 3.1]);
      }
      // Open curved wall shell (open doorway facing +Z)
      addPart(g, new THREE.CylinderGeometry(3.12, 3.18, 2.65, 24, 1, true, 0.42, Math.PI * 2 - 0.84), boneDbl, [0, 1.82, 0]);
      addPart(g, new THREE.CylinderGeometry(3.0, 3.04, 2.55, 24, 1, true, 0.43, Math.PI * 2 - 0.86), innerWall, [0, 1.8, 0]);
      // Side porthole windows
      addPart(g, new THREE.CylinderGeometry(3.15, 3.15, 0.9, 16, 1, true, 1.35, 0.8), glass, [0, 1.9, 0]);
      addPart(g, new THREE.CylinderGeometry(3.15, 3.15, 0.9, 16, 1, true, -2.15, 0.8), glass, [0, 1.9, 0]);
      // Glass dome skylight & ceiling illumination ring
      addPart(g, new THREE.TorusGeometry(3.12, 0.16, 8, 24), cobalt, [0, 3.16, 0], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.SphereGeometry(3.05, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), glass, [0, 3.1, 0], [0, 0, 0], [1, 0.6, 1]);
      addPart(g, new THREE.TorusGeometry(1.75, 0.06, 6, 22), cyan, [0, 3.15, 0], [Math.PI / 2, 0, 0]);
      // Airlock doorway bulkhead (+Z) & boarding step
      addPart(g, new THREE.BoxGeometry(0.22, 2.45, 0.44), orange, [-1.22, 1.72, 3.02]);
      addPart(g, new THREE.BoxGeometry(0.22, 2.45, 0.44), orange, [1.22, 1.72, 3.02]);
      addPart(g, new THREE.BoxGeometry(2.66, 0.25, 0.5), orange, [0, 2.95, 3.02]);
      addPart(g, new THREE.BoxGeometry(2.4, 0.18, 1.15), deckMat, [0, 0.36, 3.45]);
      // Built-in interior wall telemetry strip
      addPart(g, new THREE.BoxGeometry(1.2, 0.65, 0.16), gun, [0, 1.65, -2.82]);
      addPart(g, new THREE.BoxGeometry(0.9, 0.42, 0.06), cyan, [0, 1.68, -2.72]);
      break;
    }
    case 'large_hab': {
      // Hollow 5.2m octagonal multipurpose room with open +Z airlock doorway, interior deck, columns & glass cupola
      addPart(g, new THREE.CylinderGeometry(5.35, 5.6, 0.58, 8), gun, [0, 0.28, 0]);
      addPart(g, new THREE.CylinderGeometry(4.95, 4.95, 0.08, 8), deckMat, [0, 0.58, 0]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        addPart(g, new THREE.CylinderGeometry(0.24, 0.32, 2.8, 8), gun, [Math.cos(a) * 5.0, -0.9, Math.sin(a) * 5.0]);
      }
      // Open octagonal wall shell (open doorway facing +Z)
      addPart(g, new THREE.CylinderGeometry(5.12, 5.18, 3.6, 16, 1, true, 0.32, Math.PI * 2 - 0.64), boneDbl, [0, 2.38, 0]);
      addPart(g, new THREE.CylinderGeometry(4.96, 5.0, 3.48, 16, 1, true, 0.33, Math.PI * 2 - 0.66), innerWall, [0, 2.34, 0]);
      // Interior structural columns
      for (let i = 0; i < 6; i++) {
        const a = 0.72 + i * 0.96;
        addPart(g, new THREE.BoxGeometry(0.24, 3.4, 0.28), gun, [Math.sin(a) * 4.82, 2.3, Math.cos(a) * 4.82], [0, a, 0]);
      }
      // Panoramic observation windows
      addPart(g, new THREE.CylinderGeometry(5.15, 5.15, 1.35, 16, 1, true, 1.15, 1.15), glass, [0, 2.45, 0]);
      addPart(g, new THREE.CylinderGeometry(5.15, 5.15, 1.35, 16, 1, true, -2.3, 1.15), glass, [0, 2.45, 0]);
      // Roof rim & domed glass cupola + ceiling light ring
      addPart(g, new THREE.TorusGeometry(5.1, 0.24, 8, 16), cobalt, [0, 4.18, 0], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.SphereGeometry(5.05, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.36), glass, [0, 3.9, 0], [0, 0, 0], [1, 0.55, 1]);
      addPart(g, new THREE.TorusGeometry(3.2, 0.08, 6, 24), cyan, [0, 4.15, 0], [Math.PI / 2, 0, 0]);
      // Airlock doorway frame (+Z) & boarding dock
      addPart(g, new THREE.BoxGeometry(0.28, 3.1, 0.55), orange, [-1.52, 2.1, 4.92]);
      addPart(g, new THREE.BoxGeometry(0.28, 3.1, 0.55), orange, [1.52, 2.1, 4.92]);
      addPart(g, new THREE.BoxGeometry(3.32, 0.32, 0.6), orange, [0, 3.72, 4.92]);
      addPart(g, new THREE.BoxGeometry(3.1, 0.22, 1.5), deckMat, [0, 0.45, 5.45]);
      break;
    }
    case 'connector': {
      addPart(g, new THREE.BoxGeometry(1.8, 0.24, 5.0), deckMat, [0, 0.28, 0]);
      addPart(g, new THREE.CylinderGeometry(1.22, 1.22, 5.0, 14, 1, true), glass, [0, 1.45, 0], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.TorusGeometry(1.25, 0.14, 6, 16), gun, [0, 1.45, -2.35]);
      addPart(g, new THREE.TorusGeometry(1.25, 0.14, 6, 16), gun, [0, 1.45, 0]);
      addPart(g, new THREE.TorusGeometry(1.25, 0.14, 6, 16), gun, [0, 1.45, 2.35]);
      break;
    }
    case 'solar_panel':
      addPart(g, new THREE.CylinderGeometry(0.26, 0.42, 0.4, 10), gun, [0, 0.2, 0]);
      addPart(g, new THREE.CylinderGeometry(0.14, 0.22, 1.5, 8), gun, [0, 0.95, 0]);
      addPart(g, new THREE.BoxGeometry(2.5, 0.1, 1.5), mat(0x112a4a, { roughness: 0.12, metalness: 0.85 }), [0, 1.72, 0], [0.42, 0, 0]);
      addPart(g, new THREE.BoxGeometry(2.6, 0.08, 1.6), gun, [0, 1.66, 0], [0.42, 0, 0]);
      addPart(g, new THREE.BoxGeometry(2.4, 0.03, 0.06), cyan, [0, 1.76, 0], [0.42, 0, 0]);
      break;
    case 'battery_bank':
      addPart(g, new THREE.BoxGeometry(2.1, 0.24, 1.15), gun, [0, 0.12, 0]);
      addPart(g, new THREE.BoxGeometry(1.95, 2.0, 0.95), bone, [0, 1.15, 0]);
      for (const sx of [-0.55, 0, 0.55]) {
        addPart(g, new THREE.CylinderGeometry(0.18, 0.18, 1.5, 10), amber, [sx, 1.2, 0.36]);
        addPart(g, new THREE.TorusGeometry(0.2, 0.035, 6, 12), gun, [sx, 1.8, 0.36], [Math.PI / 2, 0, 0]);
      }
      break;
    case 'vehicle_bay':
      // Gantry crane + docking rings + charging coils + holographic beacon
      addPart(g, new THREE.BoxGeometry(5.8, 0.36, 5.4), deckMat, [0, 0.18, 0]);
      addPart(g, new THREE.BoxGeometry(5.9, 0.16, 0.35), orange, [0, 0.22, 2.6]);
      addPart(g, new THREE.BoxGeometry(0.38, 3.8, 0.38), orange, [-2.5, 2.1, -2.2]);
      addPart(g, new THREE.BoxGeometry(0.38, 3.8, 0.38), orange, [2.5, 2.1, -2.2]);
      addPart(g, new THREE.BoxGeometry(5.5, 0.42, 0.65), cobalt, [0, 3.9, -2.2]);
      addPart(g, new THREE.BoxGeometry(1.4, 0.85, 0.35), gun, [0, 1.4, -2.2]);
      addPart(g, new THREE.BoxGeometry(1.05, 0.5, 0.06), cyan, [0, 1.5, -1.98]);
      addPart(g, new THREE.TorusGeometry(1.5, 0.08, 6, 22), cyan, [0, 0.42, 0.3], [Math.PI / 2, 0, 0]);
      break;
    case 'alien_fab':
      addPart(g, new THREE.CylinderGeometry(1.0, 1.25, 0.38, 14), mat(PALETTE.pearl, { roughness: 0.28 }), [0, 0.19, 0]);
      addPart(g, new THREE.CylinderGeometry(0.45, 0.72, 1.8, 12), mat(PALETTE.obsidian, { roughness: 0.14, metalness: 0.82 }), [0, 1.1, 0]);
      addPart(g, new THREE.TorusGeometry(0.88, 0.06, 6, 20), cyan, [0, 1.35, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        addPart(g, new THREE.BoxGeometry(0.16, 1.15, 0.16), cyan, [Math.cos(a) * 0.5, 2.38, Math.sin(a) * 0.5], [0, -a, -0.35]);
      }
      addPart(g, new THREE.OctahedronGeometry(0.36), mat(0xffe9a8, { emissive: 0xffd269, emissiveIntensity: 1.9 }), [0, 2.68, 0]);
      break;
    case 'tern_pad':
      addPart(g, new THREE.CylinderGeometry(9.0, 9.4, 0.5, 24), gun, [0, 0.25, 0]);
      addPart(g, new THREE.CylinderGeometry(8.2, 8.2, 0.08, 24), deckMat, [0, 0.52, 0]);
      addPart(g, new THREE.TorusGeometry(8.5, 0.25, 6, 32), orange, [0, 0.55, 0], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.TorusGeometry(4.5, 0.16, 6, 24), cobalt, [0, 0.55, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        addPart(g, new THREE.CylinderGeometry(0.18, 0.24, 1.4, 8), gun, [Math.cos(a) * 8.6, 1.0, Math.sin(a) * 8.6]);
        addPart(g, new THREE.SphereGeometry(0.22, 8, 8), cyan, [Math.cos(a) * 8.6, 1.8, Math.sin(a) * 8.6]);
      }
      break;
    case 'hydroponics':
      addPart(g, new THREE.BoxGeometry(2.7, 0.65, 1.65), bone, [0, 0.34, 0]);
      addPart(g, new THREE.BoxGeometry(2.45, 0.12, 1.4), mat(0x3a281d, { roughness: 0.9 }), [0, 0.66, 0]);
      addPart(g, new THREE.BoxGeometry(0.12, 1.75, 0.12), gun, [-1.22, 1.35, -0.68]);
      addPart(g, new THREE.BoxGeometry(0.12, 1.75, 0.12), gun, [1.22, 1.35, -0.68]);
      addPart(g, new THREE.BoxGeometry(2.5, 0.16, 1.25), mat(0xff55dd, { emissive: 0xcc33aa, emissiveIntensity: 1.25 }), [0, 2.22, 0]);
      addPart(g, new THREE.BoxGeometry(2.55, 1.45, 1.5), glass, [0, 1.42, 0]);
      // Sculpted crops inside
      addPart(g, new THREE.SphereGeometry(0.32, 8, 6), mat(0x45d66b, { roughness: 0.65 }), [-0.65, 0.92, 0]);
      addPart(g, new THREE.SphereGeometry(0.26, 8, 6), mat(0xff9f43, { roughness: 0.55 }), [0, 0.9, 0.15]);
      addPart(g, new THREE.CylinderGeometry(0.08, 0.1, 0.85, 6), mat(0x3bd8ff, { emissive: 0x1a7899 }), [0.65, 1.1, -0.1]);
      break;
    case 'med_bay':
      addPart(g, new THREE.BoxGeometry(1.5, 0.55, 2.45), gun, [0, 0.28, 0]);
      addPart(g, new THREE.BoxGeometry(1.25, 0.22, 2.15), bone, [0, 0.66, 0.05]);
      addPart(g, new THREE.BoxGeometry(0.85, 0.16, 0.42), cobalt, [0, 0.82, -0.75]);
      addPart(g, new THREE.TorusGeometry(0.72, 0.09, 8, 16, Math.PI), bone, [0, 0.75, -0.2]);
      addPart(g, new THREE.BoxGeometry(0.45, 1.15, 0.28), gun, [0, 1.15, -1.05]);
      addPart(g, new THREE.BoxGeometry(0.35, 0.35, 0.06), mat(0x4eff9f, { emissive: 0x22cc66, emissiveIntensity: 1.3 }), [0, 1.42, -0.88]);
      addPart(g, new THREE.BoxGeometry(0.24, 0.08, 0.04), mat(0xff4444, { emissive: 0xcc1111 }), [0, 1.15, -0.88]);
      break;
    case 'water_fab':
      addPart(g, new THREE.BoxGeometry(1.2, 1.95, 0.85), bone, [0, 0.98, 0]);
      addPart(g, new THREE.CylinderGeometry(0.22, 0.22, 1.15, 12), cyan, [-0.24, 1.15, 0.24]);
      addPart(g, new THREE.CylinderGeometry(0.22, 0.22, 1.15, 12), glass, [0.24, 1.15, 0.24]);
      addPart(g, new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8), orange, [0, 1.75, 0.24], [0, 0, Math.PI / 2]);
      addPart(g, new THREE.BoxGeometry(0.7, 0.25, 0.32), gun, [0, 0.45, 0.35]);
      break;
    case 'std_fab':
      addPart(g, new THREE.BoxGeometry(1.25, 2.05, 0.78), bone, [0, 1.02, 0]);
      addPart(g, new THREE.BoxGeometry(0.92, 0.58, 0.14), amber, [0, 1.4, 0.38]);
      addPart(g, new THREE.BoxGeometry(0.84, 0.12, 0.44), gun, [0, 0.72, 0.4]);
      addPart(g, new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), orange, [-0.32, 1.05, 0.38], [0.35, 0, 0]);
      addPart(g, new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), orange, [0.32, 1.05, 0.38], [0.35, 0, 0]);
      break;
    case 'workbench':
      addPart(g, new THREE.BoxGeometry(2.1, 0.95, 1.05), gun, [0, 0.48, 0]);
      addPart(g, new THREE.BoxGeometry(2.0, 0.1, 0.98), orange, [0, 0.98, 0]);
      addPart(g, new THREE.BoxGeometry(1.85, 0.85, 0.14), cobalt, [0, 1.42, -0.42]);
      addPart(g, new THREE.BoxGeometry(1.25, 0.5, 0.04), cyan, [0, 1.44, -0.32]);
      addPart(g, new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), orange, [-0.65, 1.25, 0.1], [0.5, 0, 0.2]);
      addPart(g, new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), orange, [0.65, 1.25, 0.1], [0.5, 0, -0.2]);
      break;
    case 'bunk':
      addPart(g, new THREE.BoxGeometry(2.2, 0.55, 1.15), gun, [0, 0.28, 0]);
      addPart(g, new THREE.BoxGeometry(2.05, 0.2, 1.0), bone, [0, 0.64, 0]);
      addPart(g, new THREE.BoxGeometry(0.45, 0.14, 0.75), cobalt, [-0.72, 0.78, 0]);
      addPart(g, new THREE.BoxGeometry(1.4, 0.08, 0.08), orange, [0.1, 0.82, 0.48]);
      addPart(g, new THREE.BoxGeometry(0.24, 0.35, 0.14), amber, [-0.95, 1.05, -0.42]);
      break;
    case 'storage_locker':
      addPart(g, new THREE.BoxGeometry(1.45, 2.2, 0.75), cobalt, [0, 1.1, 0]);
      addPart(g, new THREE.BoxGeometry(1.5, 0.14, 0.8), orange, [0, 0.08, 0]);
      addPart(g, new THREE.BoxGeometry(0.62, 1.85, 0.06), gun, [-0.34, 1.12, 0.37]);
      addPart(g, new THREE.BoxGeometry(0.62, 1.85, 0.06), gun, [0.34, 1.12, 0.37]);
      addPart(g, new THREE.BoxGeometry(0.95, 0.22, 0.05), cyan, [0, 1.82, 0.4]);
      addPart(g, new THREE.BoxGeometry(0.06, 0.32, 0.08), orange, [-0.12, 1.12, 0.42]);
      addPart(g, new THREE.BoxGeometry(0.06, 0.32, 0.08), orange, [0.12, 1.12, 0.42]);
      break;
    case 'wall_locker':
      addPart(g, new THREE.BoxGeometry(1.15, 1.35, 0.52), bone, [0, 1.25, 0]);
      addPart(g, new THREE.BoxGeometry(0.48, 1.12, 0.06), gun, [-0.26, 1.25, 0.26]);
      addPart(g, new THREE.BoxGeometry(0.48, 1.12, 0.06), gun, [0.26, 1.25, 0.26]);
      addPart(g, new THREE.BoxGeometry(0.75, 0.16, 0.05), cyan, [0, 1.68, 0.28]);
      break;
    case 'work_terminal':
      addPart(g, new THREE.BoxGeometry(1.45, 0.92, 0.75), gun, [0, 0.46, 0]);
      addPart(g, new THREE.BoxGeometry(1.2, 0.08, 0.48), bone, [0, 0.94, 0.12]);
      addPart(g, new THREE.BoxGeometry(0.85, 0.04, 0.26), cyan, [0, 0.99, 0.16]);
      addPart(g, new THREE.BoxGeometry(1.25, 0.72, 0.08), gun, [0, 1.38, -0.22], [-0.15, 0, 0]);
      addPart(g, new THREE.BoxGeometry(1.12, 0.58, 0.04), cyan, [0, 1.38, -0.18], [-0.15, 0, 0]);
      break;
  }
  return g;
}

export function buildResourceNodeModel(
  item: ItemId,
  color: number,
  rich = false,
  hardened = false
): THREE.Group {
  const g = new THREE.Group();
  const baseRock = mat(hardened ? 0x262936 : 0x3b444e, { roughness: 0.85, metalness: 0.2 });
  const oreMat = mat(color, {
    roughness: item === 'hydro_crystal' || item === 'energy_cell' || item === 'sup_ore' ? 0.22 : 0.58,
    metalness: item === 'salvage' || item === 'ti_ore' || item === 'cu_ore' ? 0.65 : 0.2,
    emissive:
      item === 'energy_cell' || item === 'bio_stabilizer' || item === 'alien_biomass' || item === 'hydro_crystal' || item === 'sup_ore'
        ? color
        : 0x000000,
    emissiveIntensity: item === 'energy_cell' || item === 'bio_stabilizer' ? 0.95 : 0.42,
  });

  if (item === 'hydro_crystal' || item === 'sup_ore') {
    addPart(g, new THREE.DodecahedronGeometry(0.75, 0), baseRock, [0, 0.35, 0], [0, 0, 0], [1.2, 0.6, 1.2]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      addPart(
        g,
        new THREE.ConeGeometry(0.3 + (i % 2) * 0.12, 1.45 + (rich ? 0.45 : 0) + (i % 2) * 0.35, 6),
        oreMat,
        [Math.cos(a) * 0.28, 0.85, Math.sin(a) * 0.28],
        [Math.sin(a) * 0.28, a, -Math.cos(a) * 0.28]
      );
    }
  } else if (item === 'energy_cell') {
    addPart(g, new THREE.BoxGeometry(0.95, 0.22, 0.95), baseRock, [0, 0.11, 0]);
    addPart(g, new THREE.CylinderGeometry(0.36, 0.36, 1.15, 10), oreMat, [0, 0.68, 0]);
    addPart(g, new THREE.TorusGeometry(0.38, 0.05, 6, 14), mat(PALETTE.orange), [0, 1.05, 0], [Math.PI / 2, 0, 0]);
    addPart(g, new THREE.TorusGeometry(0.38, 0.05, 6, 14), mat(PALETTE.orange), [0, 0.35, 0], [Math.PI / 2, 0, 0]);
  } else if (item === 'salvage') {
    addPart(g, new THREE.BoxGeometry(1.45, 0.24, 1.15), oreMat, [0, 0.16, 0], [0.12, 0.3, 0.08]);
    addPart(g, new THREE.BoxGeometry(0.85, 0.18, 0.72), mat(PALETTE.gunmetal, { metalness: 0.7 }), [0.22, 0.34, -0.1], [-0.25, 0.8, 0.2]);
    addPart(g, new THREE.CylinderGeometry(0.1, 0.1, 0.9, 6), baseRock, [-0.35, 0.35, 0.15], [0.3, 0.2, 1.1]);
  } else if (item === 'alien_biomass' || item === 'bio_stabilizer') {
    addPart(g, new THREE.DodecahedronGeometry(0.68, 0), baseRock, [0, 0.3, 0], [0, 0, 0], [1.25, 0.55, 1.25]);
    addPart(g, new THREE.OctahedronGeometry(0.65), oreMat, [0, 0.88, 0]);
    addPart(g, new THREE.OctahedronGeometry(0.38), oreMat, [0.45, 0.58, -0.32], [0.4, 0.6, 0.2]);
  } else {
    // Layered ore outcrop with exposed mineral veins
    const s = rich ? 1.25 : 1.0;
    addPart(g, new THREE.DodecahedronGeometry(0.85 * s, 0), baseRock, [0, 0.42, 0], [0.2, 0.4, 0.1], [1.15, 0.78, 1.05]);
    addPart(g, new THREE.OctahedronGeometry(0.45 * s), oreMat, [0.32, 0.68, 0.22], [0.4, 0.2, 0.5]);
    addPart(g, new THREE.OctahedronGeometry(0.38 * s), oreMat, [-0.36, 0.58, -0.25], [0.2, 0.8, 0.3]);
    addPart(g, new THREE.OctahedronGeometry(0.32 * s), oreMat, [0.05, 0.88, -0.1], [0.7, 0.1, 0.4]);
  }

  return g;
}

export type CreatureKind =
  | 'skitterfin'
  | 'glass_crab'
  | 'burrow_hopper'
  | 'spore_moth'
  | 'lumen_drifter'
  | 'ash_glider'
  | 'slagback'
  | 'snapjaw'
  | 'voltaic_eel'
  | 'hollowmaw'
  | 'veilstalker'
  | 'abyssal_lancer'
  | 'lanternback'
  | 'dredgemaw'
  | 'seeker'
  | 'guardian_drone'
  | 'warden';

export function buildCreatureModel(kind: CreatureKind): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'skitterfin': {
      const body = mat(0x55d6ff, { roughness: 0.32, metalness: 0.15 });
      const fin = mat(0xffc94d, { roughness: 0.35, emissive: 0x553300, emissiveIntensity: 0.4 });
      addPart(g, new THREE.SphereGeometry(0.28, 10, 8), body, [0, 0, 0], [0, 0, 0], [0.75, 0.9, 1.85]);
      addPart(g, new THREE.BoxGeometry(0.04, 0.36, 0.32), fin, [0, 0.26, 0.05], [-0.35, 0, 0]);
      addPart(g, new THREE.BoxGeometry(0.55, 0.04, 0.24), fin, [0, -0.05, 0]);
      addPart(g, new THREE.BoxGeometry(0.04, 0.44, 0.34), fin, [0, 0, 0.56]);
      addPart(g, new THREE.SphereGeometry(0.06, 6, 6), mat(0x111111), [-0.15, 0.06, -0.36]);
      addPart(g, new THREE.SphereGeometry(0.06, 6, 6), mat(0x111111), [0.15, 0.06, -0.36]);
      break;
    }
    case 'glass_crab': {
      const shell = mat(0xb8e6f0, { transparent: true, opacity: 0.72, roughness: 0.15 });
      addPart(g, new THREE.SphereGeometry(0.45, 10, 8), shell, [0, 0.3, 0], [0, 0, 0], [1.25, 0.5, 1.05]);
      for (const sz of [-0.2, 0, 0.2]) {
        addPart(g, new THREE.BoxGeometry(1.2, 0.08, 0.1), mat(0x88c0d0), [0, 0.14, sz]);
      }
      addPart(g, new THREE.SphereGeometry(0.07, 6, 6), cyanMat(), [-0.18, 0.38, -0.4]);
      addPart(g, new THREE.SphereGeometry(0.07, 6, 6), cyanMat(), [0.18, 0.38, -0.4]);
      break;
    }
    case 'burrow_hopper': {
      addPart(g, new THREE.SphereGeometry(0.45, 10, 8), mat(0x5da860, { roughness: 0.65 }), [0, 0.5, 0], [0, 0, 0], [0.9, 0.85, 1.35]);
      addPart(g, new THREE.SphereGeometry(0.28, 8, 6), mat(0x98e678), [0, 0.72, -0.52]);
      addPart(g, new THREE.BoxGeometry(0.18, 0.45, 0.35), mat(0x4a8a4d), [-0.38, 0.25, 0.25], [0.35, 0, 0]);
      addPart(g, new THREE.BoxGeometry(0.18, 0.45, 0.35), mat(0x4a8a4d), [0.38, 0.25, 0.25], [0.35, 0, 0]);
      break;
    }
    case 'spore_moth': {
      const m = mat(0xaaff66, { emissive: 0x66cc33, emissiveIntensity: 1.25 });
      addPart(g, new THREE.CylinderGeometry(0.08, 0.06, 0.55, 8), m, [0, 0, 0], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.BoxGeometry(0.55, 0.03, 0.42), m, [-0.32, 0.08, 0], [0, 0.25, 0.2]);
      addPart(g, new THREE.BoxGeometry(0.55, 0.03, 0.42), m, [0.32, 0.08, 0], [0, -0.25, -0.2]);
      break;
    }
    case 'lumen_drifter': {
      const m = mat(0x66eeff, { emissive: 0x33bbff, emissiveIntensity: 1.4, transparent: true, opacity: 0.75 });
      addPart(g, new THREE.SphereGeometry(0.85, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m, [0, 0.25, 0]);
      addPart(g, new THREE.SphereGeometry(0.32, 10, 8), mat(0xff88dd, { emissive: 0xff44bb, emissiveIntensity: 1.5 }), [0, 0.35, 0]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        addPart(g, new THREE.CylinderGeometry(0.08, 0.02, 1.7, 6), m, [Math.cos(a) * 0.32, -0.65, Math.sin(a) * 0.32]);
      }
      break;
    }
    case 'ash_glider': {
      addPart(g, new THREE.ConeGeometry(0.35, 1.5, 8), mat(0x524b47), [0, 0, 0], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.BoxGeometry(1.5, 0.06, 0.65), mat(0x7a6558), [-0.75, 0.12, 0], [0, 0.35, 0.15]);
      addPart(g, new THREE.BoxGeometry(1.5, 0.06, 0.65), mat(0x7a6558), [0.75, 0.12, 0], [0, -0.35, -0.15]);
      break;
    }
    case 'slagback': {
      addPart(g, new THREE.SphereGeometry(1.4, 12, 10), mat(0x4a423e, { roughness: 0.85 }), [0, 1.15, 0], [0, 0, 0], [1, 0.85, 1.4]);
      addPart(g, new THREE.BoxGeometry(1.5, 1.0, 1.1), mat(0x2a2422), [0, 1.25, -2.0]);
      addPart(g, new THREE.SphereGeometry(1.25, 10, 8), mat(0xd96b27, { emissive: 0x661a00, emissiveIntensity: 1.1 }), [0, 1.95, 0], [0, 0, 0], [1.05, 0.35, 1.3]);
      break;
    }
    case 'snapjaw': {
      const body = mat(0xd9503a, { roughness: 0.38 });
      const ridge = mat(0xf28a2e, { roughness: 0.4 });
      addPart(g, new THREE.SphereGeometry(0.55, 12, 10), body, [0, 0, 0], [0, 0, 0], [0.85, 0.85, 1.85]);
      addPart(g, new THREE.BoxGeometry(0.58, 0.24, 0.85), ridge, [0, 0.14, -1.15], [-0.12, 0, 0]);
      addPart(g, new THREE.BoxGeometry(0.54, 0.2, 0.82), ridge, [0, -0.16, -1.12], [0.18, 0, 0]);
      addPart(g, new THREE.SphereGeometry(0.08, 6, 6), mat(0xffe45e, { emissive: 0xffaa00, emissiveIntensity: 1.5 }), [-0.28, 0.2, -0.9]);
      addPart(g, new THREE.SphereGeometry(0.08, 6, 6), mat(0xffe45e, { emissive: 0xffaa00, emissiveIntensity: 1.5 }), [0.28, 0.2, -0.9]);
      addPart(g, new THREE.BoxGeometry(0.12, 0.48, 1.2), ridge, [0, 0.45, 0.1]);
      addPart(g, new THREE.BoxGeometry(0.12, 0.82, 0.9), ridge, [0, 0, 1.35]);
      break;
    }
    case 'voltaic_eel': {
      const violet = mat(0x7252aa, { roughness: 0.3, emissive: 0x220044, emissiveIntensity: 0.6 });
      const glow = mat(0x44eeff, { emissive: 0x2ad6ff, emissiveIntensity: 1.6 });
      for (let i = 0; i < 5; i++) {
        const r = 0.45 - i * 0.06;
        addPart(g, new THREE.SphereGeometry(r, 10, 8), i % 2 === 0 ? violet : glow, [Math.sin(i * 0.9) * 0.18, 0, -1.6 + i * 0.9], [0, 0, 0], [0.9, 0.9, 1.4]);
      }
      addPart(g, new THREE.BoxGeometry(0.08, 0.55, 2.8), glow, [0, 0.4, 0.2]);
      break;
    }
    case 'hollowmaw': {
      addPart(g, new THREE.CylinderGeometry(0.68, 0.42, 3.0, 12), mat(0xd9d4c7, { roughness: 0.65 }), [0, 0, 0], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.TorusGeometry(0.6, 0.16, 8, 14), mat(0x8a3a3a, { emissive: 0x330a0a }), [0, 0, -1.52]);
      addPart(g, new THREE.BoxGeometry(0.15, 0.9, 0.8), mat(0x8a3a3a), [0, 0, 1.5]);
      break;
    }
    case 'veilstalker': {
      const m = mat(0x1f5a3a, { roughness: 0.45, emissive: 0x1b0b33, emissiveIntensity: 0.5 });
      addPart(g, new THREE.SphereGeometry(0.65, 10, 8), m, [0, 0.85, 0], [0, 0, 0], [0.85, 0.75, 1.75]);
      addPart(g, new THREE.BoxGeometry(0.55, 0.45, 0.95), mat(0x3b2a5c), [0, 1.05, -1.35]);
      addPart(g, new THREE.SphereGeometry(0.08, 6, 6), cyanMat(), [-0.18, 1.12, -1.75]);
      addPart(g, new THREE.SphereGeometry(0.08, 6, 6), cyanMat(), [0.18, 1.12, -1.75]);
      for (const sx of [-0.4, 0.4]) {
        addPart(g, new THREE.BoxGeometry(0.16, 0.85, 0.22), m, [sx, 0.4, 0.7]);
        addPart(g, new THREE.BoxGeometry(0.16, 0.85, 0.22), m, [sx, 0.4, -0.7]);
      }
      break;
    }
    case 'abyssal_lancer': {
      addPart(g, new THREE.CylinderGeometry(0.65, 0.95, 4.4, 10), mat(0x1a1630, { roughness: 0.38 }), [0, 0, 0], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.ConeGeometry(0.45, 2.3, 8), mat(0xcfc8b5), [0, 0, -3.1], [-Math.PI / 2, 0, 0]);
      addPart(g, new THREE.BoxGeometry(2.6, 0.12, 1.25), cyanMat(), [0, 0, 0.3]);
      break;
    }
    case 'lanternback': {
      const body = mat(0x101a3a, { roughness: 0.48 });
      const lure = mat(0xffb347, { emissive: 0xffb347, emissiveIntensity: 2.2 });
      addPart(g, new THREE.SphereGeometry(5.5, 16, 12), body, [0, 0, 0], [0, 0, 0], [0.88, 0.92, 2.25]);
      addPart(g, new THREE.BoxGeometry(6.2, 0.35, 3.2), mat(0x1b2b55), [-5.6, -1.2, -1.5], [0, 0.35, -0.25]);
      addPart(g, new THREE.BoxGeometry(6.2, 0.35, 3.2), mat(0x1b2b55), [5.6, -1.2, -1.5], [0, -0.35, 0.25]);
      addPart(g, new THREE.BoxGeometry(7.2, 0.4, 2.8), mat(0x1b2b55), [0, 0, 12.2]);
      addPart(g, new THREE.CylinderGeometry(0.25, 0.45, 9.2, 8), mat(0x1b2b55), [0, 4.6, -10.2], [0.7, 0, 0]);
      addPart(g, new THREE.SphereGeometry(1.5, 12, 10), lure, [0, 7.4, -13.6]);
      break;
    }
    case 'dredgemaw': {
      addPart(g, new THREE.CylinderGeometry(3.4, 2.6, 22, 12), mat(0x4a4f57, { roughness: 0.82 }), [0, 0, 0], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.BoxGeometry(8.8, 3.2, 7.2), mat(0xcfc8b5, { roughness: 0.6 }), [0, -0.4, -12]);
      addPart(g, new THREE.BoxGeometry(9.2, 0.6, 4.2), mat(0x3a3f46), [0, 0, 11.5]);
      const gillMat = mat(PALETTE.amber, { emissive: PALETTE.amber, emissiveIntensity: 1.8 });
      for (let i = -1; i <= 2; i++) {
        addPart(g, new THREE.BoxGeometry(7.4, 1.8, 0.75), gillMat, [0, 0.4, -4 + i * 2.8]);
      }
      break;
    }
    case 'seeker': {
      addPart(g, new THREE.ConeGeometry(0.34, 1.2, 8), mat(PALETTE.obsidian, { roughness: 0.2, metalness: 0.8 }), [0, 0, 0], [-Math.PI / 2, 0, 0]);
      addPart(g, new THREE.TorusGeometry(0.45, 0.06, 6, 14), cyanMat(), [0, 0, 0.1]);
      addPart(g, new THREE.SphereGeometry(0.18, 8, 6), cyanMat(), [0, 0, -0.58]);
      break;
    }
    case 'guardian_drone': {
      addPart(g, new THREE.TorusGeometry(0.95, 0.2, 8, 20), mat(PALETTE.obsidian, { roughness: 0.18, metalness: 0.82 }), [0, 0, 0]);
      addPart(g, new THREE.SphereGeometry(0.45, 12, 10), cyanMat(), [0, 0, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        addPart(g, new THREE.BoxGeometry(0.25, 0.95, 0.18), mat(PALETTE.pearl), [Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0], [0, 0, a]);
      }
      break;
    }
    case 'warden': {
      const obs = mat(PALETTE.obsidian, { roughness: 0.18, metalness: 0.85 });
      for (let i = 0; i < 7; i++) {
        addPart(g, new THREE.SphereGeometry(3.4 - i * 0.26, 12, 10), obs, [0, 0, -11 + i * 6.5], [0, 0, 0], [1, 0.8, 1.3]);
      }
      addPart(g, new THREE.BoxGeometry(11, 0.5, 3.2), obs, [0, 0.4, -7]);
      for (let i = 0; i < 3; i++) {
        addPart(g, new THREE.SphereGeometry(1.35, 10, 8), cyanMat(), [0, 2.8, -4 + i * 9]);
      }
      break;
    }
  }
  return g;
}

export function buildViewModel(mode: ToolMode, weapon: WeaponId): THREE.Group {
  const g = new THREE.Group();
  const gun = mat(PALETTE.gunmetal, { roughness: 0.38, metalness: 0.8 });
  const bone = mat(PALETTE.bone, { roughness: 0.42, metalness: 0.22 });
  const orange = mat(PALETTE.orange, { roughness: 0.4 });
  const cobalt = mat(PALETTE.cobalt, { roughness: 0.4 });
  const cyan = cyanMat();

  if (mode === 'weapon') {
    if (weapon === 'plasma_rifle') {
      addPart(g, new THREE.BoxGeometry(0.08, 0.1, 0.58), gun, [0, 0, 0]);
      addPart(g, new THREE.BoxGeometry(0.09, 0.045, 0.28), orange, [0, 0.06, -0.08]);
      addPart(g, new THREE.CylinderGeometry(0.025, 0.028, 0.22, 8), cyan, [0, 0.015, -0.34], [Math.PI / 2, 0, 0]);
      addPart(g, new THREE.BoxGeometry(0.04, 0.04, 0.08), cobalt, [0, 0.09, -0.04]);
    } else if (weapon === 'pulse_shotgun') {
      addPart(g, new THREE.BoxGeometry(0.11, 0.12, 0.56), gun, [0, 0, 0]);
      addPart(g, new THREE.BoxGeometry(0.12, 0.05, 0.22), orange, [0, -0.04, -0.1]);
      addPart(g, new THREE.CylinderGeometry(0.08, 0.05, 0.16, 10), mat(PALETTE.amber, { emissive: PALETTE.amber, emissiveIntensity: 1.3 }), [0, 0, -0.32], [Math.PI / 2, 0, 0]);
    } else {
      addPart(g, new THREE.BoxGeometry(0.07, 0.09, 0.85), gun, [0, 0, -0.1]);
      addPart(g, new THREE.BoxGeometry(0.08, 0.03, 0.4), cobalt, [0, 0.04, -0.25]);
      addPart(g, new THREE.CylinderGeometry(0.025, 0.025, 0.24, 8), mat(0x9955ff, { emissive: 0x8833ff, emissiveIntensity: 1.5 }), [0, 0.075, -0.12], [Math.PI / 2, 0, 0]);
    }
  } else if (mode === 'scanner') {
    addPart(g, new THREE.BoxGeometry(0.08, 0.12, 0.2), bone, [0, -0.04, 0.02], [0.25, 0, 0]);
    addPart(g, new THREE.BoxGeometry(0.1, 0.08, 0.26), gun, [0, 0.04, -0.04]);
    addPart(g, new THREE.BoxGeometry(0.08, 0.06, 0.02), cyan, [-0.055, 0.05, 0.02], [0, -0.45, 0]);
    addPart(g, new THREE.TorusGeometry(0.045, 0.012, 8, 16), cyan, [0, 0.04, -0.18]);
  } else if (mode === 'repair') {
    addPart(g, new THREE.BoxGeometry(0.08, 0.09, 0.32), orange, [0, 0, 0]);
    addPart(g, new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), gun, [0, 0.04, -0.08], [Math.PI / 2, 0, 0]);
    addPart(g, new THREE.CylinderGeometry(0.018, 0.025, 0.18, 8), mat(0xffaa33, { emissive: 0xff7700, emissiveIntensity: 1.2 }), [0, 0.01, -0.24], [Math.PI / 2, 0, 0]);
  } else if (mode === 'cutter') {
    addPart(g, new THREE.BoxGeometry(0.09, 0.11, 0.38), orange, [0, 0, 0]);
    addPart(g, new THREE.BoxGeometry(0.11, 0.05, 0.2), gun, [0, 0.05, -0.08]);
    addPart(g, new THREE.CylinderGeometry(0.02, 0.04, 0.18, 8), mat(0xff3344, { emissive: 0xff2222, emissiveIntensity: 1.5 }), [0, 0, -0.25], [Math.PI / 2, 0, 0]);
  } else {
    // Habitat Builder
    addPart(g, new THREE.BoxGeometry(0.11, 0.08, 0.28), bone, [0, 0, 0]);
    addPart(g, new THREE.TorusGeometry(0.045, 0.01, 6, 12), cyan, [0, 0.04, -0.16]);
    addPart(g, new THREE.OctahedronGeometry(0.038), cyan, [0, 0.04, -0.18]);
  }

  return g;
}
