import * as THREE from 'three';
import { BiomeId } from './types';
import { getCellCoords, HALF_WORLD, LANDMARKS, WORLD_SIZE } from './data';

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

export function fbm(x: number, z: number): number {
  return (
    valueNoise(x * 0.004 + 11.3, z * 0.004 + 7.1) * 0.54 +
    valueNoise(x * 0.011 + 3.7, z * 0.011 + 19.4) * 0.28 +
    valueNoise(x * 0.028 + 23.1, z * 0.028 + 5.9) * 0.13 +
    valueNoise(x * 0.065 + 41.2, z * 0.065 + 13.8) * 0.05
  );
}

// Sharp ridged noise for underwater canyons, basalt spines, and jagged reef ridges
function ridgedFbm(x: number, z: number): number {
  const n1 = 1 - Math.abs(valueNoise(x * 0.0055 + 7.4, z * 0.0055 + 21.8) * 2 - 1);
  const n2 = 1 - Math.abs(valueNoise(x * 0.014 + 33.1, z * 0.014 + 9.2) * 2 - 1);
  const n3 = 1 - Math.abs(valueNoise(x * 0.032 + 5.5, z * 0.032 + 44.7) * 2 - 1);
  return n1 * n1 * 0.6 + n2 * n2 * 0.28 + n3 * n3 * 0.12;
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq)) : 0;
  const cx = ax + vx * t;
  const cz = az + vz * t;
  return Math.hypot(px - cx, pz - cz);
}

function rawCellBaseHeight(x: number, z: number): number {
  const { biome } = getCellCoords(x, z);
  // Subtle domain warp for organic curved canyons and shelves
  const warpX = x + (valueNoise(x * 0.0045 + 17.2, z * 0.0045 + 8.6) - 0.5) * 95;
  const warpZ = z + (valueNoise(x * 0.0045 + 53.1, z * 0.0045 + 29.3) - 0.5) * 95;
  const n = fbm(warpX, warpZ);
  const r = ridgedFbm(warpX, warpZ);
  const micro = (valueNoise(x * 0.045, z * 0.045) - 0.5) * 6;

  switch (biome) {
    case 'jungle_coast': {
      // Stepped coastal bluffs, mossy plateaus, and undulating river ridges (0 to 92m)
      const inland = Math.max(0, Math.min(1, -z / 1400));
      const terrace = Math.floor((inland * 4.5 + n * 1.4)) * 3.5;
      return 3 + inland * 48 + (n - 0.5) * 34 + r * 14 + terrace * 0.45 + micro * 0.5;
    }
    case 'ashfall_highlands': {
      // Jagged volcanic ridges, basalt escarpments, and caldera bowls (60 to 350m)
      const ridge = Math.max(0, Math.min(1, (x + 200) / 1600));
      const north = Math.max(0, Math.min(1, -z / 1400));
      const caldera = r > 0.66 ? -(r - 0.66) * 62 : (r - 0.3) * 52;
      return 74 + (ridge * 0.55 + north * 0.45) * 205 + (n - 0.5) * 72 + caldera + micro;
    }
    case 'crash_coast': {
      // Blast-scarred dunes and tilted tectonic slabs (0 to 52m)
      return 7 + (n - 0.5) * 24 + (r - 0.35) * 18 + micro * 0.7;
    }
    case 'shallow_reef': {
      // Subnautica-style Safe Shallows: sandy valleys, coral terrace mounds, and reef ridges (-2 to -52m)
      const south = Math.max(0, Math.min(1, z / 1500));
      const sandDunes = Math.sin(warpX * 0.032 + warpZ * 0.024) * 2.2;
      const coralTable = r > 0.55 ? (r - 0.55) * 26 : -(0.55 - r) * 14;
      return -5 - south * 28 + (n - 0.5) * 20 + coralTable + sandDunes + micro * 0.45;
    }
    case 'cavern_reef': {
      // Deep winding reef gorges flanked by dramatic terraced overhang ledges (-32 to -215m)
      const westSouth = Math.max(0, Math.min(1, (z - 350) / 1100));
      const gorge = Math.max(0, 1 - Math.abs(n - 0.48) * 6.5) * 46; // winding ravine cut
      const spire = r > 0.62 ? (r - 0.62) * 38 : 0;
      return -52 - westSouth * 96 + (n - 0.5) * 42 - gorge + spire + micro;
    }
    case 'deep_trench': {
      // 4 terraced abyssal drop-offs down to -780m in H8, with basalt trench spines
      const dHeart = Math.hypot(x - LANDMARKS.heartspire.x, z - LANDMARKS.heartspire.z);
      const t = Math.max(0, Math.min(1, 1 - dHeart / 1450));
      const rawDrop = Math.pow(t, 1.32) * 615;
      // Subtle stepped shelf modulation (4 abyssal cliff terraces)
      const stepped = Math.floor(rawDrop / 145) * 145 + smooth((rawDrop % 145) / 145) * 145;
      const shelfBlend = rawDrop * 0.68 + stepped * 0.32;
      const fissure = r > 0.58 ? (r - 0.58) * 48 : -(0.4 - r) * 24;
      const base = -142 - shelfBlend + (n - 0.5) * 36 + fissure + micro;
      return Math.max(-780, base);
    }
  }
}

export function terrainHeightAt(x: number, z: number): number {
  // Smooth blend across nearby points so biome transitions form natural shelves & cliffs
  const s = 88;
  let h =
    (rawCellBaseHeight(x, z) * 2.4 +
      rawCellBaseHeight(x + s, z) +
      rawCellBaseHeight(x - s, z) +
      rawCellBaseHeight(x, z + s) +
      rawCellBaseHeight(x, z - s)) /
    6.4;

  // Fine local micro-undulation for natural seabed variation between grid cells
  const localRipple =
    (valueNoise(x * 0.032 + 12.5, z * 0.032 + 4.8) - 0.5) * 4.5 +
    Math.sin(x * 0.019 - z * 0.016) * 1.4;
  h += localRipple;

  // Coastline smoothness near z = 0 with subtle bays and headlands
  if (Math.abs(z) < 165) {
    const headland = Math.sin(x * 0.0085) * 28;
    const coastBias = -(z + headland) * 0.14;
    const blend = 0.35 * (1 - Math.abs(z) / 165);
    h = h * (1 - blend) + coastBias * blend;
  }

  // Landfall Cove (C5) sheltered coral lagoon & gentle sandy beach around Lifepod 07
  const dCove = Math.hypot(x - LANDMARKS.lifepod07.x, z - LANDMARKS.lifepod07.z);
  if (dCove < 155) {
    const w = smooth(1 - dCove / 155);
    const coveSandbar = z < 35 ? 1.8 : -7.8 + Math.sin(x * 0.05) * 1.2;
    h = h * (1 - w * 0.82) + coveSandbar * (w * 0.82);
  }

  // Safe Shallows Reef Seamount / Coral Spire (east of Landfall Cove)
  const dSeamount = Math.hypot(x - (-340), z - 320);
  if (dSeamount < 95) {
    const w = smooth(1 - dSeamount / 95);
    h = h * (1 - w * 0.55) + (-4.5 + w * 1.8) * (w * 0.55) + w * 14;
  }

  // Sunken Reef Canyon (winding gorge connecting Shallow Reef to Cavern Reef)
  const dCanyon = distToSegment(x, z, -360, 480, 320, 760);
  if (dCanyon < 72) {
    const w = smooth(1 - dCanyon / 72);
    h -= w * 34;
  }

  // Kelp Shelf Twin Trenches (B7 -> C8)
  const dKelpTrench = distToSegment(x, z, -960, 1140, -560, 1460);
  if (dKelpTrench < 60) {
    const w = smooth(1 - dKelpTrench / 60);
    h -= w * 22;
  }

  // Veil River (E2 -> C4 -> C5) fordable channel (-1.4m water)
  const dRiver = distToSegment(x, z, 200, -900, -600, -100);
  if (dRiver < 48) {
    const w = smooth(1 - dRiver / 48);
    h = Math.min(h, h * (1 - w) + (-1.4) * w);
  }

  // The Furrow (D3 -> G4) 1.2 km crash scar with raised ejecta berms
  const dFurrow = distToSegment(x, z, -120, -640, 660, -240);
  if (dFurrow < 78) {
    if (dFurrow < 48) {
      const w = smooth(1 - dFurrow / 48);
      h -= w * 11;
    } else {
      const berm = smooth(1 - Math.abs(dFurrow - 60) / 18);
      h += berm * 5.5;
    }
  }

  // The Throat (B4) 90m wide flooded sinkhole shaft down to -125m
  const dThroat = Math.hypot(x - LANDMARKS.theThroat.x, z - LANDMARKS.theThroat.z);
  if (dThroat < 90) {
    const w = smooth(1 - dThroat / 90);
    h = h * (1 - w) + (-125) * w;
  }

  // Edge of Embers (H4-H6 cliff overlook)
  if (x > 1180 && z > -280 && z < 280) {
    const t = Math.max(0, Math.min(1, (280 - z) / 560));
    if (z < 0) h = Math.max(h, 92 + t * 94);
  }

  // Volcanic Caldera Crater in Ashfall Highlands (F2-G2)
  const dCaldera = Math.hypot(x - 760, z - (-960));
  if (dCaldera < 140) {
    if (dCaldera > 88) {
      const rim = smooth(1 - Math.abs(dCaldera - 114) / 26);
      h += rim * 34;
    } else {
      const bowl = smooth(1 - dCaldera / 88);
      h -= bowl * 42;
    }
  }

  // Ember Terraces (G7-H7) stepped thermal terrace shelves around -385m
  const dEmber = Math.hypot(x - LANDMARKS.emberTerraces.x, z - LANDMARKS.emberTerraces.z);
  if (dEmber < 175) {
    const w = smooth(1 - dEmber / 175);
    h = h * (1 - w * 0.78) + (-385) * (w * 0.78);
  }

  // Heartspire basin (H8) flat platform at -760m
  const dHeart = Math.hypot(x - LANDMARKS.heartspire.x, z - LANDMARKS.heartspire.z);
  if (dHeart < 180) {
    const w = smooth(1 - dHeart / 180);
    h = h * (1 - w) + (-760) * w;
  }

  // Waystation Alpha & Beta basins
  const dWay = Math.hypot(x - LANDMARKS.waystationAlpha.x, z - LANDMARKS.waystationAlpha.z);
  if (dWay < 90) {
    const w = smooth(1 - dWay / 90);
    h = h * (1 - w) + (-85) * w;
  }
  const dWayB = Math.hypot(x - LANDMARKS.waystationBeta.x, z - LANDMARKS.waystationBeta.z);
  if (dWayB < 85) {
    const w = smooth(1 - dWayB / 85);
    h = h * (1 - w) + (-110) * w;
  }

  // Keep world perimeter naturally bounded by ocean ridges & mountain walls
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > HALF_WORLD - 95) {
    const rise = ((edge - (HALF_WORLD - 95)) / 95) * 72;
    h += rise;
  }

  return h;
}

export function getBiomeAt(x: number, z: number): BiomeId {
  return getCellCoords(x, z).biome;
}

function createTerrainDetailTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#cbd2da';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle sedimentary strata ripples
  for (let y = 0; y < 512; y += 6) {
    const tone = 192 + Math.floor(Math.sin(y * 0.11) * 14);
    ctx.fillStyle = `rgba(${tone},${tone},${tone + 4},0.22)`;
    ctx.fillRect(0, y, 512, 3);
  }

  // Mineral & sand pebble grain
  for (let i = 0; i < 12000; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const v = 160 + Math.floor(Math.random() * 80);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(px, py, 1.5 + (Math.random() > 0.72 ? 2.5 : 0), 1.5 + (Math.random() > 0.8 ? 1.5 : 0));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(110, 110);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTerrainMesh(maxAnisotropy: number): {
  terrain: THREE.Mesh;
  water: THREE.Mesh;
} {
  const segs = 224;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    pos.setY(i, terrainHeightAt(vx, vz));
  }

  // Compute smooth normals BEFORE coloring so cliff slope affects mineral & sand coloration
  geo.computeVertexNormals();
  const norm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const cliffTint = new THREE.Color(0x28323d);

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const y = pos.getY(i);
    const vz = pos.getZ(i);
    const ny = Math.max(0, Math.min(1, norm.getY(i)));
    const slope = 1 - ny; // 0 = flat shelf, >0.25 = steep cliff
    const biome = getBiomeAt(vx, vz);
    const patch = valueNoise(vx * 0.02 + 9.1, vz * 0.02 + 4.3);

    if (y >= 0) {
      if (biome === 'ashfall_highlands') {
        const elev = Math.min(1, y / 290);
        c.setRGB(0.2 + elev * 0.16 + patch * 0.05, 0.19 + elev * 0.13, 0.21 + elev * 0.1);
        if (slope > 0.22) c.lerp(new THREE.Color(0x19171a), Math.min(0.75, slope * 1.4));
      } else if (biome === 'crash_coast') {
        const dFurrow = distToSegment(vx, vz, -120, -640, 660, -240);
        if (dFurrow < 48) {
          c.setHex(0x2c282b); // fused obsidian crash scar
        } else {
          c.setHex(patch > 0.55 ? 0x9b896d : 0x7a6a55);
        }
      } else {
        // Jungle Coast
        const elev = Math.min(1, y / 85);
        c.setRGB(0.1 + elev * 0.07 + patch * 0.04, 0.32 + elev * 0.16 + patch * 0.06, 0.17 + elev * 0.05);
        if (slope > 0.24) c.lerp(new THREE.Color(0x3a3731), Math.min(0.8, slope * 1.5));
      }
    } else {
      const depth = -y;
      if (biome === 'deep_trench' || depth > 220) {
        if (depth > 480) {
          c.setHex(patch > 0.5 ? 0x0b121b : 0x101824); // Abyssal silt
        } else if (depth > 300) {
          c.setHex(patch > 0.68 ? 0x3b2219 : 0x1a1924); // Ember terraces basalt & scorched seams
        } else {
          c.setHex(0x1b2d40); // Upper trench slate
        }
        if (slope > 0.25) c.lerp(new THREE.Color(0x111720), 0.55);
      } else if (biome === 'cavern_reef' || depth > 56) {
        c.setRGB(0.14 + patch * 0.06, 0.18 + patch * 0.06, 0.34 + patch * 0.1); // Bioluminescent indigo cavern rock
        if (slope > 0.22) c.lerp(new THREE.Color(0x15192e), 0.65);
      } else {
        // Shallow Reef: warm golden-white sand shelves, teal-turquoise coral meadows, dark limestone cliffs
        const d = Math.min(1, depth / 48);
        c.setRGB(0.8 - d * 0.44 + (patch - 0.5) * 0.09, 0.74 - d * 0.28 + (patch - 0.5) * 0.06, 0.55 - d * 0.06);
        if (patch > 0.72 && depth < 32) {
          c.lerp(new THREE.Color(0x4ba89b), 0.28); // subtle coral turf patch
        }
        if (slope > 0.18) {
          c.lerp(cliffTint, Math.min(0.85, (slope - 0.18) * 2.4));
        }
      }
    }

    colors[i * 3] = Math.max(0, Math.min(1, c.r));
    colors[i * 3 + 1] = Math.max(0, Math.min(1, c.g));
    colors[i * 3 + 2] = Math.max(0, Math.min(1, c.b));
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const detailTex = createTerrainDetailTexture();
  detailTex.anisotropy = maxAnisotropy;

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTex,
    roughness: 0.88,
    metalness: 0.05,
    flatShading: false,
  });

  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;

  // Water surface plane
  const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE + 400, WORLD_SIZE + 400, 64, 64);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c96b8,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.64,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = 0;

  return { terrain, water };
}
