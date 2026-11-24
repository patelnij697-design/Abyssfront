import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ActiveModal,
  BasePieceState,
  CraftingJob,
  GameSnapshot,
  IntroState,
  ItemId,
  SaveSlotMeta,
  StationType,
  ToolMode,
  VehicleState,
  VehicleType,
  WeaponId,
} from './types';
import {
  BIOME_NAMES,
  DATABANK,
  getCellCoords,
  HALF_WORLD,
  ITEMS,
  LANDMARKS,
  LOGS,
  MISSIONS,
  RECIPES,
  WEAPONS,
} from './data';
import { createTerrainMesh, getBiomeAt, terrainHeightAt } from './world';
import {
  buildBaseStructure,
  buildCreatureModel,
  buildHeartspireComplex,
  buildLifepod07,
  buildProbeCasing,
  buildRepulsAft,
  buildRepulsBow,
  buildRepulsCrashCorridor,
  buildRepulsMidship,
  buildResourceNodeModel,
  buildSentinelSpire,
  buildSmallPodWreck,
  buildVehicleCockpit,
  buildVehicleModel,
  buildViewModel,
  buildWaystation,
  CreatureKind,
} from './models';
import { sound } from './audio';

const LEGACY_SAVE_KEY = 'abyssfront_save_v1';
const SAVE_SLOT_KEYS: Record<1 | 2 | 3, string> = {
  1: 'abyssfront_save_slot_1',
  2: 'abyssfront_save_slot_2',
  3: 'abyssfront_save_slot_3',
};

// Reusable zero-GC math helpers
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

interface ResourceNode {
  id: string;
  item: ItemId;
  x: number;
  y: number;
  z: number;
  amount: number;
  rich?: boolean;
  hardened?: boolean;
  renewable?: boolean;
  regrowTimer: number;
  mesh: THREE.Group;
}

interface CreatureEntity {
  id: string;
  kind: CreatureKind;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  armor: number;
  hearingRange: number;
  hostile: boolean;
  aquatic: boolean;
  radius: number;
  x: number;
  y: number;
  z: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  target: THREE.Vector3;
  attackCd: number;
  alertTimer: number;
  staggerTimer: number;
  flashTimer: number;
  dischargeTimer: number; // Voltaic Eel
  vulnerableTimer: number;
  mesh: THREE.Group;
  respawnTimer: number;
  dead: boolean;
}

interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  action: () => void;
  condition?: () => boolean;
}

interface TracerFX {
  line: THREE.Line;
  ttl: number;
}

const NODE_COLORS: Partial<Record<ItemId, number>> = {
  ti_ore: 0x9aa6b2,
  si_dep: 0xdbeeff,
  cu_ore: 0xd9822b,
  po_ore: 0x3b444f,
  hydro_crystal: 0x3bd8ff,
  energy_cell: 0x2ad6ff,
  alien_biomass: 0x38ff8c,
  sup_ore: 0xb088ff,
  bio_stabilizer: 0xff8a24,
  salvage: 0xc27035,
};

export class AbyssfrontEngine {
  private container: HTMLElement;
  private onSnapshot: (snap: GameSnapshot) => void;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  // Lighting & Sky
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private headLamp!: THREE.SpotLight;
  private headLampTarget!: THREE.Object3D;
  private viewModelGroup: THREE.Group | null = null;
  private cockpitGroup: THREE.Group | null = null;
  private viewKick = 0;
  private waterMesh!: THREE.Mesh;

  // World Objects
  private nodes: ResourceNode[] = [];
  private creatures: CreatureEntity[] = [];
  private hotspots: Hotspot[] = [];
  private tracers: TracerFX[] = [];
  private vehicleMeshes = new Map<string, THREE.Group>();
  private baseMeshes = new Map<string, THREE.Group>();
  private baseLights = new Map<string, THREE.PointLight>();
  private ghostMesh: THREE.Group | null = null;
  private ghostMat = new THREE.MeshBasicMaterial({ color: 0x2ad6ff, transparent: true, opacity: 0.42, depthWrite: false });
  private aegisBubble!: THREE.Mesh;
  private ternMesh!: THREE.Group;
  private cacheBeaconMesh!: THREE.Group;
  private cacheLoot: Partial<Record<ItemId, number>> | null = null;
  private cachePos = new THREE.Vector3();
  private cacheTimer = 0;

  // Heartspire & Custodian
  private heartspire!: ReturnType<typeof buildHeartspireComplex>;
  private anchorHp = [500, 500, 500];
  private custodianCycle = 0;
  private custodianAttackCd = 0;
  private seekerWaveCd = 0;
  private anchorDroneCd = 0;

  // Input state
  private keys = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private touchVert = 0;
  private touchSprint = false;
  private firing = false;
  private scanning = false;
  private scanProgress = 0;
  private scanTargetName: string | null = null;
  private yaw = 0;
  private pitch = 0;
  private camRoll = 0;
  private vel = new THREE.Vector3();
  private pointerLocked = false;
  private mouseDragActive = false;
  private mouseDragMoved = false;
  private mouseButton = 0;
  private mouseDownX = 0;
  private mouseDownY = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private touchLookId: number | null = null;
  private isSprinting = false;
  private inWaterState = false;

  // Core Game State
  private started = false;
  private creative = false;
  private paused = false;
  private activeSaveSlot: 1 | 2 | 3 = 1;
  private intro: IntroState | null = null;
  private introCorridor: ReturnType<typeof buildRepulsCrashCorridor> | null = null;
  private introImpactSoundPlayed = false;
  private introKlaxonAccum = 0;
  private ending: null | 'quiet_tide' | 'last_light' = null;
  private freeRoamAfterEnd = false;
  private escapeTimer = 0;

  private px = LANDMARKS.lifepod07.x;
  private py = 1.6;
  private pz = LANDMARKS.lifepod07.z + 0.6;
  private lifepodY = -0.35;
  private inLifepod = true;
  private respawnPos = new THREE.Vector3(LANDMARKS.lifepod07.x, 1.6, LANDMARKS.lifepod07.z + 0.5);

  private hp = 100;
  private maxHp = 100;
  private nutrition = 100;
  private hydration = 100;
  private o2 = 75;
  private o2Max = 75;
  private suitIntegrity = 100;
  private maxSuitIntegrity = 100;
  private radiation = 0;
  private crouching = false;
  private holstered = false;

  private cycleMinutes = 12; // 0..40 real-time min cycle, start at bright morning
  private weather: 'Calm' | 'Rain' | 'Spore Haze' | 'Ash Storm' = 'Calm';
  private noiseRadius = 0;
  private latticeAlert = 0;
  private raidActive = 0;
  private klaxonTimer = 0;

  private basePower = 120;
  private basePowerCap = 300;
  private baseSolarRate = 0;

  private tool: ToolMode = 'weapon';
  private weapon: WeaponId = 'plasma_rifle';
  private ownedWeapons: Record<WeaponId, boolean> = { plasma_rifle: true, pulse_shotgun: false, ion_sniper: false };
  private magAmmo: Record<WeaponId, number> = { plasma_rifle: 30, pulse_shotgun: 0, ion_sniper: 0 };
  private fireCd = 0;
  private reloadTimer = 0;
  private hasSuppressor = false;
  private hasExtMag = false;
  private suitTier: 'standard' | 'reinforced' = 'standard';
  private tankTier: 1 | 2 | 3 = 1;
  private ownedTools = { scanner: true, builder: true, repair: false, cutter: false };

  private pilotingId: string | null = null;
  private vehicles: VehicleState[] = [];
  private bases: BasePieceState[] = [];

  private ternRestored = false;
  private ternPadBuilt = false;
  private ternCharges = 3;
  private aegisTimer = 0;
  private aegisShieldHp = 0;
  private overwatchTimer = 0;
  private ternCooldowns: [number, number, number] = [0, 0, 0];

  private inventory: Partial<Record<ItemId, number>> = {};
  private unlockedIds = new Set<string>(['u_start']);
  private completedMissions = new Set<string>(['1.01']);
  private activeMissionId = '1.02';
  private discoveredLogs = new Set<string>();
  private discoveredCells = new Set<string>(['C5']);
  private scanCounts: Record<string, number> = {};
  private activeWaypoint: { x: number; y: number; z: number; label: string } | null = {
    ...LANDMARKS.lifepod07,
    y: 2,
    label: 'Lifepod 07',
  };

  private flags = {
    podFabRepaired: false,
    podWaterRepaired: false,
    auxPowerFixed: false,
    cargoCutOpen: false,
    bridgeBlackBoxTaken: false,
    armoryOpened: false,
    coolantFixed: false,
    reactorPowerOn: false,
    flightCoreTaken: false,
    glyphDoorOpened: false,
    blackBoxDecoded: false,
    authorityCodeObtained: false,
    heartspireUnlocked: false,
    nodeTideDone: false,
    nodeEchoDone: false,
    nodeWeightDone: false,
    custodianPhase: 0 as 0 | 1 | 2 | 3 | 4 | 5,
    custodianHp: 3000,
    custodianMaxHp: 3000,
    custodianExposed: false,
    echoSpeechTimer: 0,
    echoLine: '',
    disableHoldTimer: 0,
    wardenAlive: true,
  };

  private buildingMode: ItemId | null = null;
  private buildingValid = false;
  private buildingYaw = 0;
  private buildingSnapLabel: string | null = null;
  private deconstructTarget: { id: string; name: string } | null = null;
  private inHabitatName: string | null = null;
  private vehicleSpeed = 0;
  private buildPos = new THREE.Vector3();
  private craftingJob: CraftingJob | null = null;
  private activeModal: ActiveModal = null;
  private toastText: string | null = null;
  private toastTimer = 0;
  private recentUnlock: { title: string; subtitle: string } | null = null;
  private recentUnlockTimer = 0;
  private promptText: string | null = null;
  private nearestHotspot: Hotspot | null = null;
  private snapshotAccum = 0;
  private autoSaveAccum = 0;

  constructor(container: HTMLElement, onSnapshot: (snap: GameSnapshot) => void) {
    this.container = container;
    this.onSnapshot = onSnapshot;
    this.initRenderer();
    this.initScene();
    this.bindEvents();
    this.emitSnapshot();
    this.tick();
  }

  private initRenderer() {
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    this.container.appendChild(canvas);
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1f87a8, 0.008);
    this.scene.background = new THREE.Color(0x88c8e6);

    const aspect = (this.container.clientWidth || window.innerWidth) / (this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.15, 780);
    this.scene.add(this.camera);

    // Studio Environment Reflection (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Warm/cool 3-point atmospheric rig
    this.hemiLight = new THREE.HemisphereLight(0xcbe8ff, 0x1a303f, 0.95);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffe6c7, 1.35);
    this.sunLight.position.set(160, 260, -140);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.sunLight);

    // Player Headlamp (SpotLight)
    this.headLamp = new THREE.SpotLight(0xd9f6ff, 0, 75, Math.PI / 4, 0.45, 1.5);
    this.headLampTarget = new THREE.Object3D();
    this.headLampTarget.position.set(0, 0, -10);
    this.camera.add(this.headLamp);
    this.camera.add(this.headLampTarget);
    this.headLamp.target = this.headLampTarget;

    // Terrain & Water
    const { terrain, water } = createTerrainMesh(this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(terrain);
    this.scene.add(water);
    this.waterMesh = water;

    // Flora, Thermal Vents, & Environmental landmarks
    this.populateBiomeProps();
    this.populateLandmarksAndStory();
    this.populateResourceNodes();
    this.populateFauna();
    this.refreshViewModel();

    // Aegis Dome visual
    this.aegisBubble = new THREE.Mesh(
      new THREE.SphereGeometry(25, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x2ad6ff, transparent: true, opacity: 0.22, wireframe: true, depthWrite: false })
    );
    this.aegisBubble.visible = false;
    this.scene.add(this.aegisBubble);

    // Tern VTOL visual
    this.ternMesh = buildVehicleModel('tern');
    this.ternMesh.visible = false;
    this.scene.add(this.ternMesh);

    // Death Cache Beacon
    this.cacheBeaconMesh = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0xe8641b, emissive: 0xaa3300 }));
    this.cacheBeaconMesh.add(box);
    this.cacheBeaconMesh.visible = false;
    this.scene.add(this.cacheBeaconMesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private populateBiomeProps() {
    // 1. Jungle Mushroom-Trees (InstancedMesh with canopy hue variation)
    const trunkGeo = new THREE.CylinderGeometry(0.45, 0.9, 12, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2c44, roughness: 0.85 });
    const capGeo = new THREE.ConeGeometry(5.2, 3.4, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
    const treeCount = 130;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const caps = new THREE.InstancedMesh(capGeo, capMat, treeCount);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    let placed = 0;
    for (let i = 0; i < 460 && placed < treeCount; i++) {
      const tx = -1500 + ((i * 317) % 1900);
      const tz = -1500 + ((i * 541) % 1400);
      const h = terrainHeightAt(tx, tz);
      if (getBiomeAt(tx, tz) === 'jungle_coast' && h > 1.5) {
        const s = 0.78 + ((i % 7) * 0.13);
        dummy.position.set(tx, h + 6 * s - 0.3, tz);
        dummy.rotation.set(0, (i * 0.7) % (Math.PI * 2), 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        trunks.setMatrixAt(placed, dummy.matrix);
        dummy.position.set(tx, h + 12.2 * s, tz);
        dummy.updateMatrix();
        caps.setMatrixAt(placed, dummy.matrix);
        tint.setHSL(0.4 + (i % 5) * 0.025, 0.56, 0.28 + (i % 3) * 0.05);
        caps.setColorAt(placed, tint);
        placed++;
      }
    }
    trunks.count = placed;
    caps.count = placed;
    if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    caps.computeBoundingSphere();
    this.scene.add(trunks, caps);

    // 2. Shallow Reef Coral Tubes, Plate Corals & Limestone Boulders (Subnautica Safe Shallows feel)
    const coralTubeGeo = new THREE.CylinderGeometry(0.55, 0.88, 4.6, 8, 1, false);
    const coralTubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0.05 });
    const coralCount = 150;
    const coralTubes = new THREE.InstancedMesh(coralTubeGeo, coralTubeMat, coralCount);
    const coralPalette = [0xe86b54, 0xf29f67, 0xd85c8a, 0x38b6b0, 0xe8b948];
    let cIdx = 0;
    for (let i = 0; i < 550 && cIdx < coralCount; i++) {
      const cx = -1500 + ((i * 227) % 3000);
      const cz = 35 + ((i * 373) % 1050);
      if (getBiomeAt(cx, cz) !== 'shallow_reef') continue;
      if (Math.hypot(cx - LANDMARKS.lifepod07.x, cz - LANDMARKS.lifepod07.z) < 22) continue;
      const cy = terrainHeightAt(cx, cz);
      if (cy > -2.5 || cy < -48) continue;
      const s = 0.65 + (i % 6) * 0.22;
      dummy.position.set(cx, cy + 1.9 * s, cz);
      dummy.rotation.set(((i % 5) - 2) * 0.14, (i * 1.1) % (Math.PI * 2), (((i + 2) % 5) - 2) * 0.14);
      dummy.scale.set(s, s * (0.9 + (i % 3) * 0.25), s);
      dummy.updateMatrix();
      coralTubes.setMatrixAt(cIdx, dummy.matrix);
      coralTubes.setColorAt(cIdx, tint.setHex(coralPalette[i % coralPalette.length]));
      cIdx++;
    }
    coralTubes.count = cIdx;
    if (coralTubes.instanceColor) coralTubes.instanceColor.needsUpdate = true;
    coralTubes.computeBoundingSphere();
    this.scene.add(coralTubes);

    const plateGeo = new THREE.CylinderGeometry(2.6, 1.4, 0.65, 9);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58 });
    const plateCount = 95;
    const plates = new THREE.InstancedMesh(plateGeo, plateMat, plateCount);
    let pIdx = 0;
    for (let i = 0; i < 400 && pIdx < plateCount; i++) {
      const px = -1480 + ((i * 419) % 2960);
      const pz = 40 + ((i * 283) % 1020);
      if (getBiomeAt(px, pz) !== 'shallow_reef') continue;
      if (Math.hypot(px - LANDMARKS.lifepod07.x, pz - LANDMARKS.lifepod07.z) < 22) continue;
      const py = terrainHeightAt(px, pz);
      if (py > -3 || py < -50) continue;
      const s = 0.7 + (i % 5) * 0.22;
      dummy.position.set(px, py + 1.1 * s, pz);
      dummy.rotation.set(((i % 3) - 1) * 0.15, i * 0.8, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      plates.setMatrixAt(pIdx, dummy.matrix);
      plates.setColorAt(pIdx, tint.setHex(i % 2 === 0 ? 0xff7b54 : 0x38bdf8));
      pIdx++;
    }
    plates.count = pIdx;
    if (plates.instanceColor) plates.instanceColor.needsUpdate = true;
    plates.computeBoundingSphere();
    this.scene.add(plates);

    // 3. Underwater Natural Stone & Coral Sea-Arches (Iconic reef navigation landmarks)
    const archMat = new THREE.MeshStandardMaterial({ color: 0x3c4d59, roughness: 0.9, metalness: 0.05 });
    const archTrimMat = new THREE.MeshStandardMaterial({ color: 0xd86a4c, roughness: 0.65 });
    const archCoords: Array<[number, number, number, number]> = [
      [-510, 210, 14, 0.35],
      [-410, 390, 16, 1.1],
      [-680, 460, 15, -0.45],
      [-210, 520, 18, 0.8],
      [-640, 880, 20, 0.15],
      [180, 620, 18, -0.7],
    ];
    for (const [ax, az, rad, rotY] of archCoords) {
      const ay = terrainHeightAt(ax, az);
      const archGroup = new THREE.Group();
      const arc = new THREE.Mesh(new THREE.TorusGeometry(rad, rad * 0.22, 8, 18, Math.PI), archMat);
      arc.position.y = -1.5;
      archGroup.add(arc);
      const coralPatch = new THREE.Mesh(new THREE.TorusGeometry(rad * 1.02, rad * 0.12, 6, 14, Math.PI * 0.65), archTrimMat);
      coralPatch.rotation.z = Math.PI * 0.18;
      coralPatch.position.y = -1.3;
      archGroup.add(coralPatch);
      archGroup.position.set(ax, ay, az);
      archGroup.rotation.y = rotY;
      this.scene.add(archGroup);
    }

    // 4. Kelp Forest with Bioluminescent Golden Seed Pods (B8-C8)
    const kelpGeo = new THREE.CylinderGeometry(0.18, 0.26, 22, 6);
    const kelpMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68 });
    const kelpCount = 90;
    const kelp = new THREE.InstancedMesh(kelpGeo, kelpMat, kelpCount);
    const podGeo = new THREE.SphereGeometry(0.42, 8, 8);
    const podMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffa62b, emissiveIntensity: 0.9, roughness: 0.35 });
    const kelpPods = new THREE.InstancedMesh(podGeo, podMat, kelpCount * 2);
    let kIdx = 0;
    let kpIdx = 0;
    for (let i = 0; i < kelpCount; i++) {
      const kx = -1020 + ((i * 89) % 740);
      const kz = 1140 + ((i * 131) % 390);
      const ky = terrainHeightAt(kx, kz);
      const hScale = 0.8 + (i % 4) * 0.26;
      dummy.position.set(kx, ky + 10.5 * hScale, kz);
      dummy.rotation.set(((i % 3) - 1) * 0.05, 0, (((i + 1) % 3) - 1) * 0.05);
      dummy.scale.set(1, hScale, 1);
      dummy.updateMatrix();
      kelp.setMatrixAt(kIdx, dummy.matrix);
      kelp.setColorAt(kIdx, tint.setHSL(0.32 + (i % 3) * 0.02, 0.55, 0.36 + (i % 2) * 0.06));
      kIdx++;

      for (let p = 0; p < 2; p++) {
        dummy.position.set(kx + (p === 0 ? 0.35 : -0.35), ky + (9 + p * 6) * hScale, kz + (p === 0 ? 0.25 : -0.2));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        kelpPods.setMatrixAt(kpIdx++, dummy.matrix);
      }
    }
    kelp.count = kIdx;
    if (kelp.instanceColor) kelp.instanceColor.needsUpdate = true;
    kelp.computeBoundingSphere();
    kelpPods.computeBoundingSphere();
    this.scene.add(kelp, kelpPods);

    // 5. Cavern Reef Bioluminescent Jelly-Mushrooms & Glowing Spires
    const shroomCapGeo = new THREE.ConeGeometry(3.2, 2.6, 10, 1, true);
    const shroomCapMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
    const shroomStemGeo = new THREE.CylinderGeometry(0.35, 0.65, 9, 7);
    const shroomStemMat = new THREE.MeshStandardMaterial({ color: 0x333b66, roughness: 0.78 });
    const shroomCount = 72;
    const shroomCaps = new THREE.InstancedMesh(shroomCapGeo, shroomCapMat, shroomCount);
    const shroomStems = new THREE.InstancedMesh(shroomStemGeo, shroomStemMat, shroomCount);
    let sIdx = 0;
    for (let i = 0; i < 360 && sIdx < shroomCount; i++) {
      const sx = -1480 + ((i * 313) % 1950);
      const sz = 440 + ((i * 211) % 1080);
      if (getBiomeAt(sx, sz) !== 'cavern_reef') continue;
      const sy = terrainHeightAt(sx, sz);
      const s = 0.7 + (i % 5) * 0.24;
      dummy.position.set(sx, sy + 4.2 * s, sz);
      dummy.rotation.set(0, i * 0.6, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      shroomStems.setMatrixAt(sIdx, dummy.matrix);
      dummy.position.set(sx, sy + 8.6 * s, sz);
      dummy.updateMatrix();
      shroomCaps.setMatrixAt(sIdx, dummy.matrix);
      shroomCaps.setColorAt(sIdx, tint.setHex(i % 2 === 0 ? 0x38bdf8 : 0xa855f7));
      sIdx++;
    }
    shroomCaps.count = sIdx;
    shroomStems.count = sIdx;
    if (shroomCaps.instanceColor) shroomCaps.instanceColor.needsUpdate = true;
    shroomCaps.computeBoundingSphere();
    shroomStems.computeBoundingSphere();
    this.scene.add(shroomStems, shroomCaps);

    // 6. Ashfall Highlands & Deep Trench Basalt Columns
    const basaltGeo = new THREE.CylinderGeometry(1.5, 2.2, 16, 6);
    const basaltMat = new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.92, metalness: 0.1 });
    const basaltCount = 85;
    const basalts = new THREE.InstancedMesh(basaltGeo, basaltMat, basaltCount);
    let bIdx = 0;
    for (let i = 0; i < 420 && bIdx < basaltCount; i++) {
      const bx = -200 + ((i * 389) % 1720);
      const bz = -1480 + ((i * 271) % 2960);
      const biome = getBiomeAt(bx, bz);
      if (biome !== 'ashfall_highlands' && biome !== 'deep_trench') continue;
      const by = terrainHeightAt(bx, bz);
      const s = 0.8 + (i % 5) * 0.3;
      dummy.position.set(bx, by + 6.5 * s, bz);
      dummy.rotation.set(((i % 3) - 1) * 0.08, i * 0.5, (((i + 1) % 3) - 1) * 0.08);
      dummy.scale.set(s, s * 1.2, s);
      dummy.updateMatrix();
      basalts.setMatrixAt(bIdx++, dummy.matrix);
    }
    basalts.count = bIdx;
    basalts.computeBoundingSphere();
    this.scene.add(basalts);

    // 7. Ember Terraces thermal vent cones & amber lights (G7-H7)
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x261d1c, emissive: 0xff5a12, emissiveIntensity: 0.75, roughness: 0.85 });
    for (const [vx, vz] of [
      [LANDMARKS.emberTerraces.x - 45, LANDMARKS.emberTerraces.z - 25],
      [LANDMARKS.emberTerraces.x + 15, LANDMARKS.emberTerraces.z + 35],
      [LANDMARKS.emberTerraces.x + 55, LANDMARKS.emberTerraces.z - 35],
    ]) {
      const vy = terrainHeightAt(vx, vz);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 4.5, 8, 8), ventMat);
      cone.position.set(vx, vy + 4, vz);
      this.scene.add(cone);
      const vLight = new THREE.PointLight(0xff7a18, 4.5, 65);
      vLight.position.set(vx, vy + 10, vz);
      this.scene.add(vLight);
    }
  }

  private populateLandmarksAndStory() {
    // Lifepod 07 (Physical enterable & exitable cabin moored at Landfall Cove)
    const lp = buildLifepod07();
    const lpX = LANDMARKS.lifepod07.x;
    const lpZ = LANDMARKS.lifepod07.z;
    const lpY = Math.max(-0.35, terrainHeightAt(lpX, lpZ));
    this.lifepodY = lpY;
    lp.position.set(lpX, lpY, lpZ);
    this.scene.add(lp);

    // Warm interior cabin lighting
    const podLight = new THREE.PointLight(0xffdfb8, 2.4, 9);
    podLight.position.set(lpX, lpY + 2.7, lpZ);
    this.scene.add(podLight);

    // Spawn player safely inside the Lifepod cabin
    this.px = lpX;
    this.py = lpY + 1.95;
    this.pz = lpZ + 0.65;
    this.inLifepod = true;
    this.respawnPos.set(lpX, lpY + 1.95, lpZ + 0.5);

    this.addHotspot(
      'pod_fab',
      'Lifepod 07 Fabricator',
      lpX - 1.85,
      lpY + 1.4,
      lpZ - 0.2,
      3.2,
      () => {
        if (!this.flags.podFabRepaired) {
          if (this.hasItems({ ti_ore: 4, si_dep: 2 }) || this.creative) {
            if (!this.creative) this.consumeItems({ ti_ore: 4, si_dep: 2 });
            this.flags.podFabRepaired = true;
            this.unlockedIds.add('u_basic_mats');
            this.completeMission('1.02', '1.03');
            sound.playPickup();
            this.toast('Lifepod Fabricator repaired! Unlocked Alloys, Glass & Repair Tool.');
          } else {
            this.toast('Fabricator offline. Needs 4 Titanium Ore & 2 Silicate Deposits.');
          }
        } else {
          this.openModal({ type: 'station', station: 'standard' });
        }
      },
      () => this.inLifepod || Math.hypot(this.px - lpX, this.pz - lpZ) < 4.5
    );

    this.addHotspot(
      'pod_water',
      'Lifepod 07 Water Fabricator',
      lpX + 1.85,
      lpY + 1.4,
      lpZ - 0.2,
      3.2,
      () => {
        if (!this.flags.podWaterRepaired) {
          if (this.hasItems({ ti_alloy: 2, si_gel: 1 }) || this.creative) {
            if (!this.creative) this.consumeItems({ ti_alloy: 2, si_gel: 1 });
            this.flags.podWaterRepaired = true;
            this.unlockedIds.add('u_hab_basic');
            this.completeMission('1.03', '1.06');
            sound.playPickup();
            this.toast('Water Fabricator online! Hydration restored. Habitat blueprints unlocked.');
            this.hydration = 100;
          } else {
            this.toast('Water Fabricator offline. Needs 2 Titanium Alloy & 1 Silicate Gel.');
          }
        } else {
          this.hydration = 100;
          this.giveItem('hydro_gel', 1);
          sound.playPickup();
          this.toast('Hydration restored (+1 Hydro Gel).');
        }
      },
      () => this.inLifepod || Math.hypot(this.px - lpX, this.pz - lpZ) < 4.5
    );

    this.addHotspot(
      'pod_locker',
      'Lifepod 07 Storage Locker',
      lpX + 0.35,
      lpY + 1.35,
      lpZ - 1.9,
      3.0,
      () => {
        this.openModal({ type: 'inventory' });
      },
      () => this.inLifepod
    );

    this.addHotspot(
      'pod_exit',
      'Exit Lifepod 07 (Hatch)',
      lpX,
      lpY + 1.6,
      lpZ + 2.2,
      2.8,
      () => this.exitLifepod(),
      () => this.inLifepod
    );

    this.addHotspot(
      'pod_enter_door',
      'Enter Lifepod 07',
      lpX,
      lpY + 1.2,
      lpZ + 3.4,
      4.5,
      () => this.enterLifepod(),
      () => !this.inLifepod && !this.pilotingId
    );

    this.addHotspot(
      'pod_enter_top',
      'Enter Lifepod 07 (Top Hatch)',
      lpX,
      lpY + 3.8,
      lpZ,
      3.8,
      () => this.enterLifepod(),
      () => !this.inLifepod && !this.pilotingId
    );

    // Repuls Midship (F4)
    const mid = buildRepulsMidship();
    const midY = terrainHeightAt(LANDMARKS.repulsMid.x, LANDMARKS.repulsMid.z);
    mid.position.set(LANDMARKS.repulsMid.x, midY, LANDMARKS.repulsMid.z);
    this.scene.add(mid);

    // Mission 1.09 / 2.01: Crew Quarters (Damage Control Locker)
    this.addHotspot('repuls_quarters', 'Repuls Midship: Crew Quarters & Damage Control Locker', LANDMARKS.repulsMid.x - 24, midY + 5, LANDMARKS.repulsMid.z + 18, 16, () => {
      this.discoverLog('log_reyes');
      this.completeMission('1.08');
      this.completeMission('1.09', '2.01');
      if (!this.ownedTools.repair && !this.creative) {
        this.toast('Power dead at Quarters bulkhead. Craft & carry a Repair Tool first.');
        return;
      }
      if (!this.unlockedIds.has('u_cutter')) {
        this.unlockedIds.add('u_cutter');
        this.giveItem('energy_cell', 4);
        this.giveItem('salvage', 6);
        this.giveItem('ration_bar', 2);
        this.giveItem('medkit', 1);
        this.completeMission('2.01', '2.02');
        sound.playPickup();
        this.toast('Crew Quarters looted! Unlocked Laser Cutter & Reinforced Suit. Found Reyes log.');
      } else {
        this.toast('Crew Quarters already salvaged.');
      }
    });

    // Mission 2.02: Cargo Hold
    this.addHotspot('repuls_cargo', 'Repuls Midship: Cargo Hold Bulkhead', LANDMARKS.repulsMid.x + 2, midY + 5, LANDMARKS.repulsMid.z + 22, 16, () => {
      if (!this.flags.cargoCutOpen) {
        if (!this.ownedTools.cutter && !this.creative) {
          this.toast('Sealed bulkhead. Requires Laser Cutter.');
          return;
        }
        this.flags.cargoCutOpen = true;
        this.discoverLog('log_rourke');
        this.giveItem('eng_pass', 1);
        this.giveItem('energy_cell', 10);
        this.giveItem('salvage', 14);
        this.completeMission('2.02', '2.03');
        sound.playPickup();
        this.toast('Cargo Hold cut open! Found Engineering Pass, 10 Energy Cells & 14 Salvage.');
      } else if (this.getPiloted()?.type === 'prawn' && this.getPiloted()?.upgrades.grabberArm) {
        this.giveItem('salvage', 8);
        this.giveItem('energy_cell', 2);
        this.toast('PRAWN Grabber cleared collapsed wall: +8 Salvage, +2 Energy Cells.');
      } else {
        this.toast('Cargo Hold cleared. Rear collapsed wall requires PRAWN Grabber Arm.');
      }
    });

    // Mission 2.03 & 2.10: Hangar Upper (Aux Power) & Hangar Lower (Flight Core)
    this.addHotspot('repuls_hangar_up', 'Repuls Hangar: Auxiliary Power Junction', LANDMARKS.repulsMid.x + 30, midY + 5, LANDMARKS.repulsMid.z + 18, 16, () => {
      if (!this.flags.auxPowerFixed) {
        this.openModal({ type: 'puzzle', puzzleId: 'aux_power' });
      } else if (!this.flags.flightCoreTaken) {
        if (!this.flags.reactorPowerOn && !this.creative) {
          this.toast('Lower Hangar Bay locked. Restore Repuls Main Power at Aft Reactor (D3).');
          return;
        }
        this.flags.flightCoreTaken = true;
        this.giveItem('flight_core', 1);
        this.unlockedIds.add('u_hangar_lower');
        this.completeMission('2.10', '2.12');
        sound.playPickup();
        this.toast('Recovered Tern Flight Core! Unlocked PRAWN Exosuit & Tern Drop Ship blueprints.');
      } else {
        this.toast('Hangar records and Flight Core already recovered.');
      }
    });

    // Repuls Bow (G5, underwater at ~-14m)
    const bow = buildRepulsBow();
    const bowY = terrainHeightAt(LANDMARKS.repulsBow.x, LANDMARKS.repulsBow.z);
    bow.position.set(LANDMARKS.repulsBow.x, bowY, LANDMARKS.repulsBow.z);
    this.scene.add(bow);

    this.addHotspot('repuls_bridge', 'Repuls Bow: Flooded Bridge (Caustic Coolant)', LANDMARKS.repulsBow.x + 12, bowY + 8, LANDMARKS.repulsBow.z + 14, 18, () => {
      if (this.suitTier !== 'reinforced' && !this.creative) {
        this.toast('Caustic Coolant inside Bow! Craft & equip Reinforced Suit first.');
        return;
      }
      if (!this.ownedTools.cutter && !this.creative) {
        this.toast('Bridge door sealed. Craft a Laser Cutter.');
        return;
      }
      if (!this.flags.bridgeBlackBoxTaken) {
        this.flags.bridgeBlackBoxTaken = true;
        this.discoverLog('log_okafor');
        this.giveItem('black_box', 1);
        this.giveItem('captains_keycard', 1);
        this.giveItem('energy_cell', 2);
        this.completeMission('2.07', '2.08');
        sound.playPickup();
        this.toast("Recovered Black Box & Captain's Keycard! Dormant Seekers awakened!");
        this.spawnEnemyBurst('seeker', LANDMARKS.repulsBow.x, bowY + 12, LANDMARKS.repulsBow.z, 2);
      } else {
        this.toast('Bridge Black Box & Keycard already recovered.');
      }
    });

    this.addHotspot('repuls_armory', 'Repuls Bow: Armory & Project Cormorant Vault', LANDMARKS.repulsBow.x - 10, bowY + 6, LANDMARKS.repulsBow.z + 16, 18, () => {
      if (!this.flags.bridgeBlackBoxTaken && !this.creative) {
        this.toast("Requires Captain's Keycard from the Bow Bridge.");
        return;
      }
      if (!this.flags.armoryOpened) {
        this.flags.armoryOpened = true;
        this.discoverLog('log_sato');
        this.unlockedIds.add('u_armory_weapons');
        this.unlockedIds.add('u_cormorant');
        this.giveItem('energy_cell', 6);
        this.giveItem('salvage', 4);
        this.giveItem('plasma_cell_pack', 2);
        this.completeMission('2.08', '2.09');
        sound.playPickup();
        this.toast('Armory breached! Unlocked Shotgun, Ion Sniper, Bulwark & Maelstrom.');
      } else {
        this.toast('Armory vault already looted.');
      }
    });

    // Repuls Aft (D3)
    const aft = buildRepulsAft();
    const aftY = terrainHeightAt(LANDMARKS.repulsAft.x, LANDMARKS.repulsAft.z);
    aft.position.set(LANDMARKS.repulsAft.x, aftY, LANDMARKS.repulsAft.z);
    this.scene.add(aft);

    this.addHotspot('repuls_reactor', 'Repuls Aft: Engineering & Coolant Loop', LANDMARKS.repulsAft.x + 18, aftY + 6, LANDMARKS.repulsAft.z + 14, 18, () => {
      if (!this.hasItems({ eng_pass: 1 }) && !this.flags.cargoCutOpen && !this.creative) {
        this.toast('Engineering locked. Find the Engineering Pass in Midship Cargo Hold.');
        return;
      }
      if (this.suitTier !== 'reinforced' && !this.creative) {
        this.toast('Lethal Reactor Radiation! Equip Reinforced Suit first.');
        return;
      }
      this.discoverLog('log_menon');
      if (!this.unlockedIds.has('u_sup_fil')) {
        this.unlockedIds.add('u_sup_fil');
        this.giveItem('sup_filament', 4);
        this.giveItem('salvage', 8);
        this.giveItem('energy_cell', 4);
        this.toast('Engineering looted: +4 Superconductor Filaments! Now stabilize the Coolant Loop.');
      }
      if (!this.flags.coolantFixed) {
        this.openModal({ type: 'puzzle', puzzleId: 'coolant_loop' });
      } else {
        this.toast('Coolant Loop stabilized. Repuls Main Power is online.');
      }
    });

    // Other Pods (03, 05, 09, 11) + Crashed Probe Casing
    const podConfigs: Array<{ pos: { x: number; z: number }; id: string; logId: string; num: number }> = [
      { pos: LANDMARKS.pod03, id: 'pod03', logId: 'log_pod03', num: 3 },
      { pos: LANDMARKS.pod05, id: 'pod05', logId: 'log_pod05', num: 5 },
      { pos: LANDMARKS.pod09, id: 'pod09', logId: 'log_pod09', num: 9 },
      { pos: LANDMARKS.pod11, id: 'pod11', logId: 'log_pod11', num: 11 },
    ];
    for (const pc of podConfigs) {
      const m = buildSmallPodWreck(pc.num);
      const py = terrainHeightAt(pc.pos.x, pc.pos.z);
      m.position.set(pc.pos.x, py, pc.pos.z);
      this.scene.add(m);
      this.addHotspot(pc.id, `Lifepod 0${pc.num} Wreck`, pc.pos.x, py + 1.5, pc.pos.z, 9, () => {
        if (!this.discoveredLogs.has(pc.logId)) {
          this.discoverLog(pc.logId);
          this.giveItem('energy_cell', 2);
          this.giveItem('medkit', 1);
          sound.playPickup();
          this.toast(`Lifepod 0${pc.num} log recovered (+2 Energy Cells, +1 Medkit).`);
        } else {
          this.toast(`Lifepod 0${pc.num} already searched.`);
        }
      });
    }

    // Crashed Probe Casing (F2)
    const probe = buildProbeCasing();
    const probeY = terrainHeightAt(LANDMARKS.probeCasing.x, LANDMARKS.probeCasing.z);
    probe.position.set(LANDMARKS.probeCasing.x, probeY, LANDMARKS.probeCasing.z);
    this.scene.add(probe);
    this.addHotspot('probe_casing', 'Crashed Resonance Probe Casing', LANDMARKS.probeCasing.x, probeY + 2, LANDMARKS.probeCasing.z, 10, () => {
      this.discoverLog('mural_1');
      this.toast('Union Resonance Probe launch casing—the Repuls fired first.');
    });

    // Waystations Alpha (D7) & Beta (B7)
    const wa = buildWaystation();
    const waY = terrainHeightAt(LANDMARKS.waystationAlpha.x, LANDMARKS.waystationAlpha.z);
    wa.position.set(LANDMARKS.waystationAlpha.x, waY, LANDMARKS.waystationAlpha.z);
    this.scene.add(wa);
    this.addHotspot('waystation_alpha', 'Orrin Waystation Alpha (Glyph Door)', LANDMARKS.waystationAlpha.x, waY + 4, LANDMARKS.waystationAlpha.z + 12, 16, () => {
      this.discoverLog('log_amadi');
      this.discoverLog('mural_1');
      this.discoverLog('mural_2');
      if (!this.flags.glyphDoorOpened) {
        this.openModal({ type: 'puzzle', puzzleId: 'glyph_door' });
      } else {
        this.toast('Waystation Alpha chamber open. Alien Fabricator & Orrin Mural blueprints unlocked.');
      }
    });

    const wb = buildWaystation();
    const wbY = terrainHeightAt(LANDMARKS.waystationBeta.x, LANDMARKS.waystationBeta.z);
    wb.position.set(LANDMARKS.waystationBeta.x, wbY, LANDMARKS.waystationBeta.z);
    this.scene.add(wb);

    // Sentinel Spires (Highlands Sentinel Corridor G3, Edge of Embers H5, Heartspire approach)
    for (const [sx, sz] of [
      [LANDMARKS.sentinelCorridor.x, LANDMARKS.sentinelCorridor.z],
      [LANDMARKS.sentinelCorridor.x + 35, LANDMARKS.sentinelCorridor.z - 25],
      [LANDMARKS.edgeOfEmbers.x, LANDMARKS.edgeOfEmbers.z + 120],
    ]) {
      const sp = buildSentinelSpire();
      const sy = terrainHeightAt(sx, sz);
      sp.position.set(sx, sy, sz);
      this.scene.add(sp);
      sp.userData = { sx, sy, sz };
      this.sentinelSpires.push(sp);
    }

    // The Heartspire (H8, -760m)
    this.heartspire = buildHeartspireComplex();
    const hsY = terrainHeightAt(LANDMARKS.heartspire.x, LANDMARKS.heartspire.z);
    this.heartspire.root.position.set(LANDMARKS.heartspire.x, hsY, LANDMARKS.heartspire.z);
    this.scene.add(this.heartspire.root);

    // Seal Door Hotspot
    this.addHotspot('hs_seal', 'Heartspire Seal (760m)', LANDMARKS.heartspire.x, hsY + 14, LANDMARKS.heartspire.z - 42, 22, () => {
      if (!this.flags.heartspireUnlocked) {
        if (this.hasItems({ lattice_key: 1 }) || this.creative) {
          this.flags.heartspireUnlocked = true;
          this.latticeAlert = Math.min(100, this.latticeAlert + 20);
          this.completeMission('3.07', '3.08');
          sound.playOrrinChord();
          this.toast('Heartspire Seal unlocked! Pressure equalized inside. Solve the 3 Node Chambers!');
        } else {
          this.toast('Heartspire Seal locked. Craft the Lattice Key at an Alien Fabricator.');
        }
      } else {
        this.toast('Heartspire Seal open. Enter the Core Chamber platform ahead.');
      }
    });

    // 3 Outer Ring Node Chamber Hotspots
    this.addHotspot('node_tide', 'Node 1: Tide Chamber (Repair Tool)', LANDMARKS.heartspire.x - 24, hsY + 6, LANDMARKS.heartspire.z - 18, 14, () => {
      if (!this.flags.heartspireUnlocked && !this.creative) return this.toast('Unlock the Heartspire Seal first.');
      if (this.flags.nodeTideDone) return this.toast('Tide Chamber aligned.');
      if (!this.ownedTools.repair && !this.creative) return this.toast('Requires Repair Tool to align Tide Gates.');
      this.flags.nodeTideDone = true;
      sound.playOrrinChord();
      this.toast('Tide Chamber aligned! Node Key 1/3 acquired.');
      this.checkAllNodesDone();
    });

    this.addHotspot('node_echo', 'Node 2: Echo Chamber (Holster Weapon & Scanner)', LANDMARKS.heartspire.x + 24, hsY + 6, LANDMARKS.heartspire.z - 18, 14, () => {
      if (!this.flags.heartspireUnlocked && !this.creative) return this.toast('Unlock the Heartspire Seal first.');
      if (this.flags.nodeEchoDone) return this.toast('Echo Chamber harmonized.');
      this.discoverLog('mural_3');
      if (!this.holstered && !this.creative) {
        this.hurtPlayer(10);
        return this.toast('Weapon signature detected! Holster weapon [X] before pinging Echo pillars (-10 HP).');
      }
      this.flags.nodeEchoDone = true;
      sound.playOrrinChord();
      this.toast('Echo Pillars pinged in ascending pitch! Node Key 2/3 acquired.');
      this.checkAllNodesDone();
    });

    this.addHotspot('node_weight', 'Node 3: Weight Chamber (PRAWN / Heavy Mass)', LANDMARKS.heartspire.x, hsY + 6, LANDMARKS.heartspire.z - 26, 14, () => {
      if (!this.flags.heartspireUnlocked && !this.creative) return this.toast('Unlock the Heartspire Seal first.');
      if (this.flags.nodeWeightDone) return this.toast('Weight Chamber balanced.');
      const piloted = this.getPiloted();
      if (piloted?.type === 'prawn' || this.hasItems({ salvage: 4 }) || this.creative) {
        this.flags.nodeWeightDone = true;
        sound.playOrrinChord();
        this.toast('Pressure plates weighted! Node Key 3/3 acquired.');
        this.checkAllNodesDone();
      } else {
        this.toast('Needs PRAWN Exosuit or 4 Salvage crates to weight the pressure plates.');
      }
    });

    // Core Terminal (Phase 4 Choice or Start Boss)
    this.addHotspot('core_terminal', 'Lattice Core Terminal', LANDMARKS.heartspire.x, hsY + 5, LANDMARKS.heartspire.z + 10, 14, () => {
      if (!this.flags.heartspireUnlocked && !this.creative) return this.toast('Unlock the Heartspire Seal first.');
      if (!this.flags.nodeTideDone || !this.flags.nodeEchoDone || !this.flags.nodeWeightDone) {
        if (!this.creative) return this.toast('Complete all 3 Outer Ring Node Chambers first.');
      }
      if (this.flags.custodianPhase === 0) {
        this.flags.custodianPhase = 1;
        this.flags.custodianHp = 3000;
        this.flags.custodianMaxHp = 3000;
        this.custodianCycle = 0;
        sound.playOrrinChord();
        this.toast('THE CUSTODIAN AWAKENS! Wait for its obsidian petals to vent heat!');
      } else if (this.flags.custodianPhase === 4) {
        this.openModal({ type: 'puzzle', puzzleId: 'core_terminal' });
      } else if (this.flags.custodianPhase < 4) {
        this.toast('Core Terminal shielded by the Custodian!');
      }
    });
  }

  private sentinelSpires: THREE.Group[] = [];

  private checkAllNodesDone() {
    if (this.flags.nodeTideDone && this.flags.nodeEchoDone && this.flags.nodeWeightDone) {
      this.completeMission('3.08', '3.09');
      this.toast('All 3 Node Keys acquired! Approach the Core Terminal to face the Custodian.');
    }
  }

  private populateResourceNodes() {
    const addNode = (item: ItemId, x: number, y: number, z: number, amount: number, opts: { rich?: boolean; hardened?: boolean; renewable?: boolean } = {}) => {
      const color = NODE_COLORS[item] ?? 0xaaaaaa;
      const mesh = buildResourceNodeModel(item, color, opts.rich, opts.hardened);
      mesh.position.set(x, y, z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(mesh);

      this.nodes.push({
        id: `n_${this.nodes.length}`,
        item,
        x,
        y: y + 0.65,
        z,
        amount,
        rich: opts.rich,
        hardened: opts.hardened,
        renewable: opts.renewable,
        regrowTimer: 0,
        mesh,
      });
    };

    // Scatter across exact biomes per Section 8 (scaled instance counts with guaranteed rich coverage near landmarks)
    const scatterInBiome = (targetBiome: string, item: ItemId, count: number, avgAmount: number, opts: { rich?: boolean; hardened?: boolean; renewable?: boolean; minDepth?: number; maxDepth?: number } = {}) => {
      let placed = 0;
      for (let tries = 0; tries < count * 16 && placed < count; tries++) {
        const x = (Math.random() - 0.5) * 3000;
        const z = (Math.random() - 0.5) * 3000;
        if (getBiomeAt(x, z) !== targetBiome) continue;
        const y = terrainHeightAt(x, z);
        const depth = -y;
        if (opts.minDepth !== undefined && depth < opts.minDepth) continue;
        if (opts.maxDepth !== undefined && depth > opts.maxDepth) continue;
        addNode(item, x, y, z, avgAmount, opts);
        placed++;
      }
    };

    // Guaranteed starter clusters right around Lifepod 07 (C5) for crisp Act I onboarding
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 24 + (i % 3) * 14;
      const x = LANDMARKS.lifepod07.x + Math.cos(a) * r;
      const z = LANDMARKS.lifepod07.z + 30 + Math.sin(a) * r;
      const y = terrainHeightAt(x, z);
      addNode(i % 3 === 0 ? 'si_dep' : 'ti_ore', x, y, z, 4);
    }

    scatterInBiome('shallow_reef', 'ti_ore', 95, 4);
    scatterInBiome('shallow_reef', 'ti_ore', 15, 6, { rich: true, renewable: true, minDepth: 25 });
    scatterInBiome('shallow_reef', 'si_dep', 45, 3);
    scatterInBiome('shallow_reef', 'salvage', 30, 2);
    // 12 Lifepod Debris Energy Cells across Shallow Reef
    scatterInBiome('shallow_reef', 'energy_cell', 12, 1);

    // Jungle Coast
    scatterInBiome('jungle_coast', 'cu_ore', 48, 3);
    scatterInBiome('jungle_coast', 'po_ore', 45, 3);
    scatterInBiome('jungle_coast', 'hydro_crystal', 36, 3, { renewable: true });
    // Guaranteed Rivermouth cluster
    for (let i = 0; i < 6; i++) {
      const rx = LANDMARKS.rivermouth.x + (i - 3) * 16;
      const rz = LANDMARKS.rivermouth.z - 25 - (i % 2) * 18;
      addNode(i % 2 === 0 ? 'cu_ore' : 'hydro_crystal', rx, terrainHeightAt(rx, rz), rz, 3, { renewable: i % 2 !== 0 });
    }

    // Highlands & Crash Coast
    scatterInBiome('ashfall_highlands', 'cu_ore', 32, 3);
    scatterInBiome('crash_coast', 'salvage', 32, 2);

    // Cavern Reef (Voltclusters + Silicate + Biomass)
    scatterInBiome('cavern_reef', 'si_dep', 36, 3);
    scatterInBiome('cavern_reef', 'alien_biomass', 30, 2, { renewable: true });
    scatterInBiome('cavern_reef', 'energy_cell', 24, 1, { renewable: true });

    // Deep Trench (Upper Terraces Superconductor, Ember Terraces Stabilizers, Hardened Plasteel)
    scatterInBiome('deep_trench', 'sup_ore', 14, 2, { minDepth: 120, maxDepth: 260 });
    scatterInBiome('deep_trench', 'sup_ore', 10, 2, { hardened: true, minDepth: 280, maxDepth: 520 });
    scatterInBiome('deep_trench', 'po_ore', 30, 3, { hardened: true });
    scatterInBiome('deep_trench', 'alien_biomass', 18, 2, { renewable: true });

    // 12 Bio-Plasma Stabilizers at Ember Terraces (G7-H7)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 30 + (i % 3) * 28;
      const sx = LANDMARKS.emberTerraces.x + Math.cos(a) * r;
      const sz = LANDMARKS.emberTerraces.z + Math.sin(a) * r;
      addNode('bio_stabilizer', sx, terrainHeightAt(sx, sz), sz, 1);
    }
  }

  private populateFauna() {
    const spawn = (kind: CreatureKind, x: number, y: number, z: number, cfg: Partial<CreatureEntity>) => {
      const mesh = buildCreatureModel(kind);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.creatures.push({
        id: `c_${this.creatures.length}`,
        kind,
        hp: cfg.hp ?? 90,
        maxHp: cfg.hp ?? 90,
        speed: cfg.speed ?? 6,
        damage: cfg.damage ?? 12,
        armor: cfg.armor ?? 0,
        hearingRange: cfg.hearingRange ?? 50,
        hostile: cfg.hostile ?? true,
        aquatic: cfg.aquatic ?? true,
        radius: cfg.radius ?? 1.6,
        x,
        y,
        z,
        homeX: x,
        homeY: y,
        homeZ: z,
        target: new THREE.Vector3(x, y, z),
        attackCd: 0,
        alertTimer: 0,
        staggerTimer: 0,
        flashTimer: 0,
        dischargeTimer: 4 + Math.random() * 5,
        vulnerableTimer: 0,
        mesh,
        respawnTimer: 0,
        dead: false,
      });
    };

    const scatter = (biome: string, kind: CreatureKind, count: number, cfg: Partial<CreatureEntity>, yOffset = 6) => {
      let placed = 0;
      for (let i = 0; i < count * 12 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 3000;
        const z = (Math.random() - 0.5) * 3000;
        if (getBiomeAt(x, z) !== biome) continue;
        const ty = terrainHeightAt(x, z);
        if (cfg.aquatic !== false && ty > -3) continue;
        if (cfg.aquatic === false && ty < 1) continue;
        const y = cfg.aquatic === false ? ty + 0.5 : Math.min(-2, ty + yOffset);
        spawn(kind, x, y, z, cfg);
        placed++;
      }
    };

    // Non-hostile & Food
    scatter('shallow_reef', 'skitterfin', 20, { hp: 10, hostile: false, speed: 5, radius: 0.9 }, 4);
    scatter('shallow_reef', 'glass_crab', 10, { hp: 20, hostile: false, speed: 2.5, radius: 0.9 }, 0.5);
    scatter('jungle_coast', 'burrow_hopper', 12, { hp: 25, hostile: false, aquatic: false, speed: 4, radius: 1.0 }, 0);
    scatter('jungle_coast', 'spore_moth', 10, { hp: 5, hostile: false, aquatic: false, speed: 3, radius: 0.6 }, 3);
    scatter('cavern_reef', 'lumen_drifter', 14, { hp: 15, hostile: false, speed: 1.5, radius: 1.2 }, 12);
    scatter('ashfall_highlands', 'ash_glider', 8, { hp: 30, hostile: false, aquatic: false, speed: 9, radius: 1.2 }, 16);
    scatter('ashfall_highlands', 'slagback', 6, { hp: 400, hostile: false, aquatic: false, speed: 4, damage: 30, radius: 2.6 }, 0);

    // Hostile
    scatter('shallow_reef', 'snapjaw', 14, { hp: 90, speed: 8, damage: 12, hearingRange: 60, radius: 1.6 }, 5);
    scatter('jungle_coast', 'veilstalker', 9, { hp: 160, aquatic: false, speed: 9, damage: 25, hearingRange: 55, radius: 1.8 }, 0);
    scatter('cavern_reef', 'voltaic_eel', 8, { hp: 140, speed: 9, damage: 18, hearingRange: 50, radius: 2.0 }, 10);
    scatter('cavern_reef', 'hollowmaw', 8, { hp: 120, speed: 12, damage: 25, hearingRange: 35, radius: 1.8 }, 16);
    scatter('deep_trench', 'abyssal_lancer', 9, { hp: 600, speed: 11, damage: 45, hearingRange: 80, radius: 2.8 }, 16);

    // 2 Lanternbacks & 2 Dredgemaws
    for (const [lx, lz] of [[780, 650], [950, 1180]]) {
      spawn('lanternback', lx, terrainHeightAt(lx, lz) + 32, lz, { hp: 2500, speed: 8, damage: 90, hearingRange: 60, radius: 6.5 });
    }
    for (const [dx, dz] of [[860, 860], [1200, 1100]]) {
      spawn('dredgemaw', dx, terrainHeightAt(dx, dz) + 25, dz, { hp: 4000, speed: 7, damage: 110, hearingRange: 150, radius: 9.0 });
    }

    // 1 Warden Leviathan guarding Heartspire approach (H8)
    spawn('warden', 1220, terrainHeightAt(1220, 1240) + 28, 1240, {
      hp: 6000,
      speed: 8.5,
      damage: 85,
      armor: 0.2,
      hearingRange: 75,
      radius: 10.5,
    });

    // Guardian Drones around Waystations & Heartspire
    for (const [gx, gz] of [
      [LANDMARKS.waystationAlpha.x + 18, LANDMARKS.waystationAlpha.z],
      [LANDMARKS.waystationBeta.x - 18, LANDMARKS.waystationBeta.z],
      [LANDMARKS.sentinelCorridor.x, LANDMARKS.sentinelCorridor.z + 25],
    ]) {
      const gy = terrainHeightAt(gx, gz);
      spawn('guardian_drone', gx, gy + (gy < 0 ? 12 : 4), gz, {
        hp: 200,
        speed: 4,
        damage: 20,
        armor: 0.3,
        hearingRange: 45,
        aquatic: gy < 0,
        radius: 1.6,
      });
    }
  }

  private spawnEnemyBurst(kind: CreatureKind, x: number, y: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const mesh = buildCreatureModel(kind);
      const sx = x + (Math.random() - 0.5) * 14;
      const sz = z + (Math.random() - 0.5) * 14;
      mesh.position.set(sx, y, sz);
      this.scene.add(mesh);
      this.creatures.push({
        id: `b_${Date.now()}_${i}_${Math.random()}`,
        kind,
        hp: kind === 'seeker' ? 40 : 200,
        maxHp: kind === 'seeker' ? 40 : 200,
        speed: kind === 'seeker' ? 12 : 5,
        damage: kind === 'seeker' ? 10 : 20,
        armor: kind === 'guardian_drone' ? 0.3 : 0,
        hearingRange: 90,
        hostile: true,
        aquatic: y < 0,
        radius: 1.4,
        x: sx,
        y,
        z: sz,
        homeX: sx,
        homeY: y,
        homeZ: sz,
        target: new THREE.Vector3(this.px, this.py, this.pz),
        attackCd: 0.5,
        alertTimer: 30,
        staggerTimer: 0,
        flashTimer: 0,
        dischargeTimer: 0,
        vulnerableTimer: 0,
        mesh,
        respawnTimer: 0,
        dead: false,
      });
    }
  }

  private addHotspot(
    id: string,
    label: string,
    x: number,
    y: number,
    z: number,
    radius: number,
    action: () => void,
    condition?: () => boolean
  ) {
    this.hotspots.push({ id, label, x, y, z, radius, action, condition });
  }

  private enterLifepod() {
    if (this.pilotingId) return;
    this.px = LANDMARKS.lifepod07.x;
    this.py = this.lifepodY + 1.95;
    this.pz = LANDMARKS.lifepod07.z + 0.7;
    this.vel.set(0, 0, 0);
    this.inLifepod = true;
    this.crouching = false;
    this.yaw = 0.65;
    this.pitch = -0.05;
    this.respawnPos.set(LANDMARKS.lifepod07.x, this.lifepodY + 1.95, LANDMARKS.lifepod07.z + 0.5);
    sound.playHatch();
    this.toast('Entered Lifepod 07 — Pressurized Cabin (O₂ restoring).');
    this.emitSnapshot();
  }

  private exitLifepod() {
    this.inLifepod = false;
    this.px = LANDMARKS.lifepod07.x;
    this.py = this.lifepodY + 1.45;
    this.pz = LANDMARKS.lifepod07.z + 4.35;
    this.vel.set(0, 0, 0);
    this.yaw = Math.PI; // face out toward Landfall Cove
    this.pitch = -0.08;
    sound.playHatch();
    this.toast('Exited Lifepod 07 into Landfall Cove.');
    this.emitSnapshot();
  }

  // ---- Public API for React UI ----

  private migrateLegacySaveIfNeeded() {
    try {
      const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
      if (legacy && !localStorage.getItem(SAVE_SLOT_KEYS[1])) {
        localStorage.setItem(SAVE_SLOT_KEYS[1], legacy);
      }
    } catch {
      // ignore storage access issues
    }
  }

  public getSaveSlots(): SaveSlotMeta[] {
    this.migrateLegacySaveIfNeeded();
    return ([1, 2, 3] as const).map((slotId) => {
      try {
        const raw = localStorage.getItem(SAVE_SLOT_KEYS[slotId]);
        if (!raw) {
          return {
            slotId,
            empty: true,
            creative: false,
            savedAt: 0,
            cell: 'C5',
            biomeName: 'Shallow Reef',
            depth: 0,
            activeMissionId: '1.02',
            missionTitle: 'First Air & Metal',
            basesCount: 0,
            vehiclesCount: 0,
          };
        }
        const d = JSON.parse(raw);
        const px = typeof d.px === 'number' ? d.px : LANDMARKS.lifepod07.x;
        const py = typeof d.py === 'number' ? d.py : 1.6;
        const pz = typeof d.pz === 'number' ? d.pz : LANDMARKS.lifepod07.z;
        const cellInfo = getCellCoords(px, pz);
        const activeMissionId = d.activeMissionId ?? '1.02';
        const mDef = MISSIONS.find((m) => m.id === activeMissionId);
        return {
          slotId,
          empty: false,
          creative: !!d.creative,
          savedAt: typeof d.savedAt === 'number' ? d.savedAt : Date.now(),
          cell: d.cell ?? cellInfo.code,
          biomeName: d.biomeName ?? BIOME_NAMES[cellInfo.biome],
          depth: typeof d.depth === 'number' ? d.depth : Math.max(0, Math.round(-py)),
          activeMissionId,
          missionTitle: d.missionTitle ?? mDef?.title ?? 'Deep Salvage',
          basesCount: Array.isArray(d.bases) ? d.bases.length : 0,
          vehiclesCount: Array.isArray(d.vehicles) ? d.vehicles.length : 0,
        };
      } catch {
        return {
          slotId,
          empty: true,
          creative: false,
          savedAt: 0,
          cell: 'C5',
          biomeName: 'Shallow Reef',
          depth: 0,
          activeMissionId: '1.02',
          missionTitle: 'First Air & Metal',
          basesCount: 0,
          vehiclesCount: 0,
        };
      }
    });
  }

  private clearIntroCorridor() {
    if (this.introCorridor) {
      this.scene.remove(this.introCorridor.group);
      this.introCorridor = null;
    }
  }

  private resetWorldEntitiesForSession() {
    this.clearIntroCorridor();
    this.intro = null;
    this.introImpactSoundPlayed = false;
    this.introKlaxonAccum = 0;

    this.setBuildingMode(null);
    this.pilotingId = null;
    this.craftingJob = null;
    this.ending = null;
    this.freeRoamAfterEnd = false;
    this.escapeTimer = 0;

    for (const mesh of this.vehicleMeshes.values()) this.scene.remove(mesh);
    this.vehicleMeshes.clear();
    this.vehicles = [];

    for (const mesh of this.baseMeshes.values()) this.scene.remove(mesh);
    this.baseMeshes.clear();
    for (const light of this.baseLights.values()) this.scene.remove(light);
    this.baseLights.clear();
    this.bases = [];
    this.ternMesh.visible = false;

    this.hp = 100;
    this.maxHp = 100;
    this.nutrition = 100;
    this.hydration = 100;
    this.o2 = 75;
    this.o2Max = 75;
    this.suitIntegrity = 100;
    this.maxSuitIntegrity = 100;
    this.radiation = 0;
    this.crouching = false;
    this.holstered = false;
    this.tool = 'weapon';
    this.weapon = 'plasma_rifle';
    this.ownedTools = { scanner: true, builder: true, repair: false, cutter: false };
    this.ownedWeapons = { plasma_rifle: true, pulse_shotgun: false, ion_sniper: false };
    this.magAmmo = { plasma_rifle: 30, pulse_shotgun: 0, ion_sniper: 0 };
    this.hasSuppressor = false;
    this.hasExtMag = false;
    this.suitTier = 'standard';
    this.tankTier = 1;
    this.unlockedIds = new Set(['u_start']);
    this.completedMissions = new Set(['1.01']);
    this.activeMissionId = '1.02';
    this.discoveredLogs = new Set();
    this.discoveredCells = new Set(['C5']);
    this.scanCounts = {};
    this.ternRestored = false;
    this.ternPadBuilt = false;
    this.ternCharges = 3;
    this.latticeAlert = 0;
    this.basePower = 120;
    this.basePowerCap = 300;
    this.flags = {
      podFabRepaired: false,
      podWaterRepaired: false,
      auxPowerFixed: false,
      cargoCutOpen: false,
      bridgeBlackBoxTaken: false,
      armoryOpened: false,
      coolantFixed: false,
      reactorPowerOn: false,
      flightCoreTaken: false,
      glyphDoorOpened: false,
      blackBoxDecoded: false,
      authorityCodeObtained: false,
      heartspireUnlocked: false,
      nodeTideDone: false,
      nodeEchoDone: false,
      nodeWeightDone: false,
      custodianPhase: 0,
      custodianHp: 3000,
      custodianMaxHp: 3000,
      custodianExposed: false,
      echoSpeechTimer: 0,
      echoLine: '',
      disableHoldTimer: 0,
      wardenAlive: true,
    };
  }

  private startCrashIntro() {
    this.clearIntroCorridor();
    this.introCorridor = buildRepulsCrashCorridor();
    this.introCorridor.group.position.set(0, 920, 0);
    this.scene.add(this.introCorridor.group);

    this.px = 0;
    this.py = 921.8;
    this.pz = 10.5;
    this.yaw = 0;
    this.pitch = 0.02;
    this.camRoll = 0;
    this.vel.set(0, 0, 0);
    this.inLifepod = false;
    this.introImpactSoundPlayed = false;
    this.introKlaxonAccum = 0;
    this.intro = {
      phase: 'evacuate',
      timer: 0,
      blackoutAlpha: 0,
      headline: 'TFR-419 REPULS · HULL FAILURE',
      subtitle: 'Atmospheric breakup! Move forward down Deck 4 and board Lifepod 07.',
    };
    this.refreshViewModel();
    sound.playKlaxon();
  }

  public skipIntro() {
    if (!this.intro) return;
    this.clearIntroCorridor();
    this.intro = null;
    this.px = LANDMARKS.lifepod07.x;
    this.py = this.lifepodY + 1.95;
    this.pz = LANDMARKS.lifepod07.z + 0.7;
    this.inLifepod = true;
    this.yaw = 0.75;
    this.pitch = -0.05;
    this.camRoll = 0;
    this.vel.set(0, 0, 0);
    this.o2 = this.o2Max;
    this.hp = this.maxHp;
    this.refreshViewModel();
    this.saveGame(this.activeSaveSlot);
    this.toast('Lifepod 07 Impact — Gather 4 Titanium Ore & 2 Silicate from Landfall Cove to repair the Fabricator.');
    this.emitSnapshot();
  }

  private updateIntro(dt: number) {
    if (!this.intro || !this.introCorridor) return;
    this.intro.timer += dt;
    const t = this.intro.timer;

    // Dark smoky orbital crash environment
    (this.scene.background as THREE.Color).setHex(0x160d10);
    (this.scene.fog as THREE.FogExp2).color.setHex(0x1b1014);
    (this.scene.fog as THREE.FogExp2).density = 0.026;
    this.hemiLight.intensity = 0.65;
    this.sunLight.intensity = 0.85;
    this.headLamp.intensity = 2.6;

    // Pulsing emergency klaxon lights & structural hull shudder
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
    for (const kl of this.introCorridor.klaxonLights) {
      kl.intensity = 1.5 + pulse * 5.2;
    }
    this.introCorridor.group.rotation.z = Math.sin(performance.now() * 0.0022) * 0.04;

    if (this.intro.phase === 'evacuate') {
      this.introKlaxonAccum += dt;
      if (this.introKlaxonAccum >= 2.8) {
        this.introKlaxonAccum = 0;
        sound.playKlaxon();
      }

      const fwdIn = this.joyY + (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
      const strafeIn = this.joyX + (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
      _euler.set(0, this.yaw, 0, 'YXZ');
      const fwd = _v1.set(0, 0, -1).applyEuler(_euler);
      const right = _v2.set(1, 0, 0).applyEuler(_euler);
      const wish = _v3.set(0, 0, 0).addScaledVector(fwd, fwdIn).addScaledVector(right, strafeIn);
      if (wish.lengthSq() > 1) wish.normalize();
      const sprinting = this.keys.has('ShiftLeft') || this.touchSprint;
      wish.multiplyScalar(sprinting ? 8.2 : 5.6);

      this.vel.x = THREE.MathUtils.lerp(this.vel.x, wish.x, Math.min(1, 9 * dt));
      this.vel.z = THREE.MathUtils.lerp(this.vel.z, wish.z, Math.min(1, 9 * dt));
      this.px = THREE.MathUtils.clamp(this.px + this.vel.x * dt, -1.9, 1.9);
      this.pz = THREE.MathUtils.clamp(this.pz + this.vel.z * dt, -12.0, 11.8);
      this.py = 921.8;

      const shakeX = Math.sin(performance.now() * 0.032) * 0.035;
      const shakeY = Math.cos(performance.now() * 0.041) * 0.025;
      this.camera.position.set(this.px + shakeX, this.py + shakeY, this.pz);
      this.camera.rotation.set(this.pitch, this.yaw, this.introCorridor.group.rotation.z * 0.5, 'YXZ');

      this.promptText = this.pz <= -6.8 ? '[E] Board Lifepod 07' : null;
      if (this.pz <= -9.6) {
        this.beginIntroEjection();
      }
    } else if (this.intro.phase === 'ejection') {
      this.promptText = null;
      // Slide blast hatch closed
      this.introCorridor.hatchDoor.position.x = THREE.MathUtils.damp(this.introCorridor.hatchDoor.position.x, 0, 7, dt);

      // Seat camera in launch cradle
      this.px = THREE.MathUtils.damp(this.px, 0, 6, dt);
      this.pz = THREE.MathUtils.damp(this.pz, -11.45, 6, dt);
      this.py = THREE.MathUtils.damp(this.py, 921.68, 6, dt);
      this.yaw = THREE.MathUtils.damp(this.yaw, 0, 6, dt);
      this.pitch = THREE.MathUtils.damp(this.pitch, -0.06, 6, dt);

      const intensity = Math.min(1, t / 2.2) * 0.09;
      const jx = (Math.random() - 0.5) * intensity;
      const jy = (Math.random() - 0.5) * intensity;
      this.camera.position.set(this.px + jx, this.py + jy, this.pz);
      this.camera.rotation.set(this.pitch + jy * 0.4, this.yaw + jx * 0.4, (Math.random() - 0.5) * intensity * 0.7, 'YXZ');

      if (t >= 2.2) {
        this.intro.subtitle = 'WARNING: Loose emergency fire extinguisher bracket failing!';
        this.introCorridor.fireExtinguisher.rotation.z = Math.sin(t * 42) * 0.22;
      }
      if (t >= 3.6) {
        this.intro.phase = 'impact';
        this.intro.timer = 0;
        this.intro.headline = 'UNSECURED HARDWARE IMPACT';
        this.intro.subtitle = 'Loose fire extinguisher detached!';
      }
    } else if (this.intro.phase === 'impact') {
      const k = Math.min(1, t / 0.42);
      // Hurl tumbling fire extinguisher straight into camera visor
      const ext = this.introCorridor.fireExtinguisher;
      ext.position.set(
        THREE.MathUtils.lerp(-1.05, 0, k),
        THREE.MathUtils.lerp(1.75, 1.68, k),
        THREE.MathUtils.lerp(-12.35, -11.62, k)
      );
      ext.rotation.set(k * 9.5, k * 5.2, k * 7.8);

      if (t >= 0.42 && !this.introImpactSoundPlayed) {
        this.introImpactSoundPlayed = true;
        sound.playExtinguisherImpact();
        this.pitch = 0.32;
        this.camRoll = -0.35;
      }

      if (t >= 0.42) {
        this.intro.blackoutAlpha = Math.min(1, (t - 0.42) / 0.55);
      }
      this.camera.position.set(this.px + (Math.random() - 0.5) * 0.14, this.py + (Math.random() - 0.5) * 0.14, this.pz);
      this.camera.rotation.set(this.pitch, this.yaw, this.camRoll, 'YXZ');

      if (t >= 1.55) {
        this.clearIntroCorridor();
        this.px = LANDMARKS.lifepod07.x;
        this.py = this.lifepodY + 1.95;
        this.pz = LANDMARKS.lifepod07.z + 0.7;
        this.inLifepod = true;
        this.yaw = 0.75;
        this.pitch = -0.05;
        this.camRoll = 0;
        this.vel.set(0, 0, 0);
        this.o2 = this.o2Max;
        this.hp = this.maxHp;
        this.refreshViewModel();
        this.intro.phase = 'wake';
        this.intro.timer = 0;
        this.intro.blackoutAlpha = 1;
        this.intro.headline = 'THETA-9 · LANDFALL COVE';
        this.intro.subtitle = 'Emergency Reboot: Lifepod 07 splashdown complete. Vital signs nominal.';
      }
    } else if (this.intro.phase === 'wake') {
      this.intro.blackoutAlpha = Math.max(0, 1 - t / 1.7);
      this.updateAtmosphere(0, false);
      this.camera.position.set(this.px, this.py, this.pz);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      if (t >= 1.85) {
        this.intro = null;
        this.saveGame(this.activeSaveSlot);
        this.toast('Lifepod 07 Impact — Gather 4 Titanium Ore & 2 Silicate from Landfall Cove to repair the Fabricator.');
        this.emitSnapshot();
      }
    }

    this.snapshotAccum += dt;
    if (this.snapshotAccum >= 0.06) {
      this.snapshotAccum = 0;
      this.emitSnapshot();
    }
  }

  private beginIntroEjection() {
    if (!this.intro || this.intro.phase !== 'evacuate') return;
    this.intro.phase = 'ejection';
    this.intro.timer = 0;
    this.intro.headline = 'LIFEPOD 07 LAUNCH SEQUENCE';
    this.intro.subtitle = 'Hatch sealed — booster ignition! Brace for atmospheric drop.';
    this.promptText = null;
    sound.playHatch();
    sound.playLaunchRumble();
    this.emitSnapshot();
  }

  // ---- Public API for React UI ----

  public startNewGame(creative: boolean, slotId: 1 | 2 | 3 = 1, skipIntro = false) {
    this.resetWorldEntitiesForSession();
    this.activeSaveSlot = slotId;
    this.creative = creative;
    this.started = true;
    this.paused = false;
    this.activeModal = null;

    // Starting kit (Mission 1.01)
    this.inventory = creative
      ? {
          ti_ore: 50,
          si_dep: 40,
          cu_ore: 40,
          po_ore: 40,
          hydro_crystal: 30,
          energy_cell: 40,
          alien_biomass: 20,
          sup_ore: 20,
          bio_stabilizer: 16,
          salvage: 30,
          ti_alloy: 20,
          plasteel: 20,
          cu_wire: 20,
          glass: 20,
          sup_filament: 10,
          plasma_cell_pack: 10,
          plasma_shell_pack: 6,
          medkit: 6,
          ration_bar: 5,
          hydro_gel: 5,
        }
      : {
          plasma_cell_pack: 1,
          ration_bar: 3,
          hydro_gel: 2,
          medkit: 1,
        };

    if (creative) {
      this.px = LANDMARKS.lifepod07.x;
      this.py = this.lifepodY + 1.95;
      this.pz = LANDMARKS.lifepod07.z + 0.7;
      this.inLifepod = true;
      this.yaw = 0.75;
      this.pitch = -0.05;
      this.vel.set(0, 0, 0);
      for (const r of RECIPES) this.unlockedIds.add(r.unlockId);
      this.ownedTools = { scanner: true, builder: true, repair: true, cutter: true };
      this.ownedWeapons = { plasma_rifle: true, pulse_shotgun: true, ion_sniper: true };
      this.magAmmo = { plasma_rifle: 30, pulse_shotgun: 6, ion_sniper: 6 };
      this.suitTier = 'reinforced';
      this.tankTier = 3;
      this.o2Max = 200;
      this.o2 = 200;
      this.unlockedIds.add('u_lattice_key');
      this.flags.authorityCodeObtained = true;
      this.flags.podFabRepaired = true;
      this.flags.podWaterRepaired = true;
      this.refreshViewModel();
      this.saveGame(slotId);
      this.toast('Creative Mode: All blueprints, tools & infinite vitals active. Open Map [Tab] to warp anywhere.');
    } else if (!skipIntro) {
      this.startCrashIntro();
    } else {
      this.px = LANDMARKS.lifepod07.x;
      this.py = this.lifepodY + 1.95;
      this.pz = LANDMARKS.lifepod07.z + 0.7;
      this.inLifepod = true;
      this.yaw = 0.75;
      this.pitch = -0.05;
      this.vel.set(0, 0, 0);
      this.refreshViewModel();
      this.saveGame(slotId);
      this.toast('Lifepod 07 Impact — Gather 4 Titanium Ore & 2 Silicate from Landfall Cove to repair the Fabricator.');
    }
    this.emitSnapshot();
  }

  public returnToMainMenu() {
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.clearIntroCorridor();
    this.intro = null;
    this.started = false;
    this.paused = false;
    this.activeModal = null;
    this.firing = false;
    this.scanning = false;
    this.keys.clear();
    this.emitSnapshot();
  }

  public hasSavedGame(): boolean {
    return this.getSaveSlots().some((s) => !s.empty);
  }

  public deleteSaveSlot(slotId: 1 | 2 | 3) {
    try {
      localStorage.removeItem(SAVE_SLOT_KEYS[slotId]);
      if (slotId === 1) localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      // ignore storage issues
    }
    this.emitSnapshot();
  }

  public loadSavedGame(slotId: 1 | 2 | 3 = 1): boolean {
    this.migrateLegacySaveIfNeeded();
    try {
      const raw = localStorage.getItem(SAVE_SLOT_KEYS[slotId]);
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.resetWorldEntitiesForSession();
      this.activeSaveSlot = slotId;
      this.started = true;
      this.paused = false;
      this.activeModal = null;
      this.creative = !!d.creative;
      this.px = d.px ?? LANDMARKS.lifepod07.x;
      this.py = d.py ?? this.lifepodY + 1.95;
      this.pz = d.pz ?? LANDMARKS.lifepod07.z + 0.7;
      this.inLifepod = Math.hypot(this.px - LANDMARKS.lifepod07.x, this.pz - LANDMARKS.lifepod07.z) < 2.4 && this.py >= this.lifepodY;
      this.hp = d.hp ?? 100;
      this.nutrition = d.nutrition ?? 100;
      this.hydration = d.hydration ?? 100;
      this.o2 = d.o2 ?? 75;
      this.o2Max = d.o2Max ?? 75;
      this.suitTier = d.suitTier ?? 'standard';
      this.tankTier = d.tankTier ?? 1;
      this.inventory = d.inventory ?? {};
      this.ownedTools = d.ownedTools ?? this.ownedTools;
      this.ownedWeapons = d.ownedWeapons ?? this.ownedWeapons;
      this.magAmmo = d.magAmmo ?? this.magAmmo;
      this.hasSuppressor = !!d.hasSuppressor;
      this.hasExtMag = !!d.hasExtMag;
      this.unlockedIds = new Set(d.unlockedIds ?? ['u_start']);
      this.completedMissions = new Set(d.completedMissions ?? ['1.01']);
      this.activeMissionId = d.activeMissionId ?? '1.02';
      this.discoveredLogs = new Set(d.discoveredLogs ?? []);
      this.discoveredCells = new Set(d.discoveredCells ?? ['C5']);
      this.scanCounts = d.scanCounts ?? {};
      this.flags = { ...this.flags, ...(d.flags ?? {}) };
      this.ternRestored = !!d.ternRestored;
      this.ternPadBuilt = !!d.ternPadBuilt;
      this.latticeAlert = d.latticeAlert ?? 0;

      if (Array.isArray(d.vehicles)) {
        for (const v of d.vehicles as VehicleState[]) {
          this.spawnVehicleState(v);
        }
      }
      if (Array.isArray(d.bases)) {
        for (const b of d.bases as BasePieceState[]) {
          this.placeBaseState(b);
        }
      }
      this.refreshViewModel();
      this.toast(`Slot ${slotId} (${this.creative ? 'Creative' : 'Survival'}) loaded.`);
      this.emitSnapshot();
      return true;
    } catch {
      return false;
    }
  }

  public saveGame(slotId: 1 | 2 | 3 = this.activeSaveSlot, showToast = false) {
    if (!this.started || this.intro) return;
    this.activeSaveSlot = slotId;
    const cellInfo = getCellCoords(this.px, this.pz);
    const mDef = MISSIONS.find((m) => m.id === this.activeMissionId);
    try {
      localStorage.setItem(
        SAVE_SLOT_KEYS[slotId],
        JSON.stringify({
          creative: this.creative,
          savedAt: Date.now(),
          cell: cellInfo.code,
          biomeName: BIOME_NAMES[cellInfo.biome],
          depth: Math.max(0, Math.round(-this.py)),
          missionTitle: mDef?.title ?? 'Deep Salvage',
          px: this.px,
          py: this.py,
          pz: this.pz,
          hp: this.hp,
          nutrition: this.nutrition,
          hydration: this.hydration,
          o2: this.o2,
          o2Max: this.o2Max,
          suitTier: this.suitTier,
          tankTier: this.tankTier,
          inventory: this.inventory,
          ownedTools: this.ownedTools,
          ownedWeapons: this.ownedWeapons,
          magAmmo: this.magAmmo,
          hasSuppressor: this.hasSuppressor,
          hasExtMag: this.hasExtMag,
          unlockedIds: Array.from(this.unlockedIds),
          completedMissions: Array.from(this.completedMissions),
          activeMissionId: this.activeMissionId,
          discoveredLogs: Array.from(this.discoveredLogs),
          discoveredCells: Array.from(this.discoveredCells),
          scanCounts: this.scanCounts,
          flags: this.flags,
          ternRestored: this.ternRestored,
          ternPadBuilt: this.ternPadBuilt,
          latticeAlert: this.latticeAlert,
          vehicles: this.vehicles,
          bases: this.bases,
        })
      );
      if (showToast) {
        this.toast(`Saved to Slot ${slotId} (${this.creative ? 'Creative' : 'Survival'}).`);
        this.emitSnapshot();
      }
    } catch {
      // ignore storage quota errors
    }
  }

  public setTouchInput(jx: number, jy: number, vert: number, fire: boolean, scan?: boolean, sprint?: boolean) {
    this.joyX = jx;
    this.joyY = jy;
    this.touchVert = vert;
    this.firing = fire;
    if (typeof scan === 'boolean') {
      this.scanning = scan;
      if (!scan) {
        this.scanProgress = 0;
        this.scanTargetName = null;
      }
    }
    if (typeof sprint === 'boolean') {
      this.touchSprint = sprint;
    }
  }

  public setFiring(active: boolean) {
    this.firing = active;
  }

  public setScanning(active: boolean) {
    this.scanning = active;
    if (!active) {
      this.scanProgress = 0;
      this.scanTargetName = null;
    }
    this.emitSnapshot();
  }

  public triggerReload() {
    this.startReload();
    this.emitSnapshot();
  }

  public cycleSlot(dir: 1 | -1) {
    if (!this.started || this.activeModal || this.ending || this.pilotingId) return;
    const slots: Array<{ kind: 'weapon'; id: WeaponId } | { kind: 'tool'; id: ToolMode }> = [];
    (['plasma_rifle', 'pulse_shotgun', 'ion_sniper'] as WeaponId[]).forEach((w) => {
      if (this.ownedWeapons[w] || this.creative) slots.push({ kind: 'weapon', id: w });
    });
    slots.push({ kind: 'tool', id: 'scanner' });
    if (this.ownedTools.repair || this.creative) slots.push({ kind: 'tool', id: 'repair' });
    if (this.ownedTools.cutter || this.creative) slots.push({ kind: 'tool', id: 'cutter' });
    slots.push({ kind: 'tool', id: 'builder' });

    if (slots.length === 0) return;
    let idx = slots.findIndex((s) =>
      this.tool === 'weapon' ? s.kind === 'weapon' && s.id === this.weapon : s.kind === 'tool' && s.id === this.tool
    );
    if (idx === -1 || this.holstered) idx = dir > 0 ? -1 : 0;
    const next = slots[(idx + dir + slots.length) % slots.length];
    if (next.kind === 'weapon') {
      this.selectWeapon(next.id);
    } else {
      this.setTool(next.id);
      this.toast(
        next.id === 'scanner'
          ? 'Scanner'
          : next.id === 'repair'
          ? 'Repair Tool'
          : next.id === 'cutter'
          ? 'Laser Cutter'
          : 'Habitat Builder'
      );
    }
  }

  public openModal(modal: ActiveModal) {
    if (this.intro && modal) return;
    this.activeModal = modal;
    this.paused = !!modal;
    this.firing = false;
    this.scanning = false;
    this.mouseDragActive = false;
    this.keys.clear();
    if (modal && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.emitSnapshot();
  }

  public setTool(t: ToolMode) {
    if (t === 'repair' && !this.ownedTools.repair && !this.creative) return this.toast('Craft Repair Tool first.');
    if (t === 'cutter' && !this.ownedTools.cutter && !this.creative) return this.toast('Craft Laser Cutter first.');
    const alreadyBuilder = this.tool === 'builder' && !this.holstered;
    this.tool = t;
    if (t !== 'builder') this.setBuildingMode(null);
    this.holstered = false;
    this.refreshViewModel();
    if (t === 'builder' && alreadyBuilder && !this.buildingMode) {
      this.openModal({ type: 'station', station: 'builder' });
      return;
    }
    this.emitSnapshot();
  }

  public selectWeapon(w: WeaponId) {
    if (!this.ownedWeapons[w] && !this.creative) return this.toast(`${WEAPONS[w].name} not crafted yet.`);
    this.weapon = w;
    this.tool = 'weapon';
    this.holstered = false;
    this.setBuildingMode(null);
    this.refreshViewModel();
    this.toast(WEAPONS[w].name);
    this.emitSnapshot();
  }

  public toggleHolster() {
    this.holstered = !this.holstered;
    this.refreshViewModel();
    this.toast(this.holstered ? 'Weapon holstered (Sentinel Spires stand down).' : 'Weapon drawn.');
    this.emitSnapshot();
  }

  public setBuildingMode(item: ItemId | null) {
    this.buildingMode = item;
    this.buildingSnapLabel = null;
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }
    if (item) {
      this.tool = 'builder';
      this.holstered = false;
      this.activeModal = null;
      this.paused = false;
      this.ghostMesh = buildBaseStructure(item as BasePieceState['type']);
      this.ghostMesh.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = this.ghostMat;
      });
      this.scene.add(this.ghostMesh);
      this.updateBuildingGhost();
      this.toast(`Placing ${ITEMS[item].name} — Click/[E] build, [Q/R] rotate, [Esc] cancel.`);
    } else {
      this.buildingValid = false;
    }
    this.refreshViewModel();
    this.emitSnapshot();
  }

  public rotateBuildGhost(deltaDeg = 45) {
    if (!this.buildingMode) return;
    this.buildingYaw += THREE.MathUtils.degToRad(deltaDeg);
    this.emitSnapshot();
  }

  public placeCurrentBuilding() {
    if (!this.buildingMode) return;
    this.tryPlaceBuilding();
  }

  public deconstructTargetPiece() {
    if (!this.deconstructTarget) return;
    const idx = this.bases.findIndex((b) => b.id === this.deconstructTarget?.id);
    if (idx === -1) return;
    const piece = this.bases[idx];
    this.bases.splice(idx, 1);
    const mesh = this.baseMeshes.get(piece.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.baseMeshes.delete(piece.id);
    }
    const light = this.baseLights.get(piece.id);
    if (light) {
      this.scene.remove(light);
      this.baseLights.delete(piece.id);
    }
    if (piece.type === 'tern_pad') {
      this.ternPadBuilt = this.bases.some((b) => b.type === 'tern_pad');
      if (!this.ternPadBuilt) this.ternMesh.visible = false;
    }
    if (!this.creative) {
      const rec = RECIPES.find((r) => r.station === 'builder' && r.output === piece.type);
      if (rec) {
        for (const [k, q] of Object.entries(rec.ingredients)) {
          this.giveItem(k as ItemId, q ?? 0);
        }
      }
    }
    sound.playPickup();
    this.toast(`Deconstructed ${ITEMS[piece.type]?.name ?? piece.type} (100% materials refunded).`);
    this.deconstructTarget = null;
    this.emitSnapshot();
  }

  public craftRecipe(recipeId: string) {
    const rec = RECIPES.find((r) => r.id === recipeId);
    if (!rec) return;
    if (rec.station === 'builder') {
      if (!this.hasItems(rec.ingredients) && !this.creative) return this.toast('Missing materials.');
      this.setBuildingMode(rec.output);
      return;
    }
    if (this.craftingJob) return this.toast('Fabricator busy.');
    if (!this.creative && !this.hasItems(rec.ingredients)) return this.toast('Missing materials.');
    if (rec.id === 'r_lattice_key' && !this.flags.authorityCodeObtained && !this.creative) {
      return this.toast("Decode Pod 07 Black Box at Alien Fabricator for Captain's Authority first.");
    }
    if (!this.creative && this.basePower < rec.powerCost && rec.station !== 'standard') {
      return this.toast('Insufficient Base Power (build Solar Panels / Battery Banks).');
    }

    if (!this.creative) {
      this.consumeItems(rec.ingredients);
      this.basePower = Math.max(0, this.basePower - rec.powerCost);
    }

    if (rec.craftTime <= 0.1 || this.creative) {
      this.finishCraft(rec.id);
    } else {
      this.craftingJob = {
        recipeId: rec.id,
        name: rec.name,
        output: rec.output,
        outputQty: rec.outputQty,
        station: rec.station,
        remaining: rec.craftTime,
        total: rec.craftTime,
      };
      sound.playScan();
    }
    this.emitSnapshot();
  }

  private finishCraft(recipeId: string) {
    const rec = RECIPES.find((r) => r.id === recipeId);
    if (!rec) return;

    if (rec.isAlien) {
      this.latticeAlert = Math.min(100, this.latticeAlert + 5);
    }

    const out = rec.output;
    if (out === 'repair_tool') this.ownedTools.repair = true;
    else if (out === 'laser_cutter') this.ownedTools.cutter = true;
    else if (out === 'pulse_shotgun') {
      this.ownedWeapons.pulse_shotgun = true;
      this.magAmmo.pulse_shotgun = 6;
    } else if (out === 'ion_sniper') {
      this.ownedWeapons.ion_sniper = true;
      this.magAmmo.ion_sniper = 6;
    } else if (out === 'o2_mk2') {
      this.tankTier = Math.max(this.tankTier, 2) as 1 | 2 | 3;
      this.recomputeO2Max();
    } else if (out === 'o2_mk3') {
      this.tankTier = 3;
      this.recomputeO2Max();
    } else if (out === 'reinforced_suit') {
      this.suitTier = 'reinforced';
      this.maxSuitIntegrity = 150;
      this.suitIntegrity = 150;
      this.recomputeO2Max();
      this.completeMission('2.06');
    } else if (out === 'suppressor') this.hasSuppressor = true;
    else if (out === 'ext_mag') this.hasExtMag = true;
    else if (out === 'stingray' || out === 'hover_skiff' || out === 'prawn' || out === 'bulwark') {
      this.createNewVehicle(out);
    } else if (out === 'tern_restore') {
      this.ternRestored = true;
      this.ternCharges = 3;
      this.toast('Tern Drop Ship restored! Build a Tern Landing Pad on land to deploy support.');
    } else if (out === 'depth_mk1' || out === 'depth_mk2' || out === 'speed_mod' || out === 'storage_mod' || out === 'power_cell_mk2' || out === 'skiff_boost' || out === 'resonance_plating' || out === 'pressure_lattice' || out === 'prawn_drill' || out === 'prawn_grabber' || out === 'prawn_thruster' || out === 'prawn_cargo' || out === 'maelstrom') {
      this.applyVehicleUpgrade(out);
    } else {
      this.giveItem(out, rec.outputQty);
    }

    sound.playPickup();
    this.toast(`Crafted: ${rec.name}`);
    if (out === 'bulwark') this.completeMission('3.04', '3.07');
    this.emitSnapshot();
  }

  public decodeBlackBox() {
    if (!this.hasItems({ black_box: 1 }) && !this.flags.bridgeBlackBoxTaken && !this.creative) {
      return this.toast('Recover the Repuls Black Box from the Bow Bridge first.');
    }
    this.flags.blackBoxDecoded = true;
    this.flags.authorityCodeObtained = true;
    this.unlockedIds.add('u_lattice_key');
    this.discoverLog('log_varga_final');
    this.completeMission('3.02', '3.04');
    sound.playOrrinChord();
    this.toast("Black Box decoded! Captain Varga's Authority Code & Lattice Key blueprint unlocked.");
    this.emitSnapshot();
  }

  public useConsumable(item: ItemId) {
    if (!this.creative && !this.hasItems({ [item]: 1 })) return;
    if (item === 'medkit') {
      if (this.hp >= this.maxHp) return this.toast('Health already full.');
      if (!this.creative) this.consumeItems({ medkit: 1 });
      this.hp = Math.min(this.maxHp, this.hp + 50);
    } else if (item === 'ration_bar') {
      if (!this.creative) this.consumeItems({ ration_bar: 1 });
      this.nutrition = Math.min(100, this.nutrition + 30);
    } else if (item === 'reef_fillet') {
      if (!this.creative) this.consumeItems({ reef_fillet: 1 });
      this.nutrition = Math.min(100, this.nutrition + 20);
    } else if (item === 'gourd') {
      if (!this.creative) this.consumeItems({ gourd: 1 });
      this.nutrition = Math.min(100, this.nutrition + 25);
    } else if (item === 'bloomfruit') {
      if (!this.creative) this.consumeItems({ bloomfruit: 1 });
      this.nutrition = Math.min(100, this.nutrition + 15);
      this.hydration = Math.min(100, this.hydration + 5);
    } else if (item === 'hydro_gel') {
      if (!this.creative) this.consumeItems({ hydro_gel: 1 });
      this.hydration = Math.min(100, this.hydration + 20);
    } else if (item === 'hydro_cane') {
      if (!this.creative) this.consumeItems({ hydro_cane: 1 });
      this.hydration = Math.min(100, this.hydration + 10);
    }
    sound.playPickup();
    this.emitSnapshot();
  }

  public activateTernPower(idx: 0 | 1 | 2) {
    if (!this.ternRestored && !this.creative) return this.toast('Tern Drop Ship not restored.');
    if (!this.ternPadBuilt && !this.creative) return this.toast('Build a Tern Landing Pad on land first.');
    if (this.py < -10) return this.toast('Tern operates only on land or within 10m of the surface.');
    if (this.ternCooldowns[idx] > 0) return this.toast(`Cooling down (${Math.ceil(this.ternCooldowns[idx])}s).`);
    if (this.ternCharges <= 0 && !this.creative) {
      if (this.hasItems({ energy_cell: 1 })) {
        this.consumeItems({ energy_cell: 1 });
        this.ternCharges = 3;
      } else {
        return this.toast('Tern out of charges (requires 1 Energy Cell to reload 3 charges).');
      }
    }

    if (!this.creative) this.ternCharges--;
    if (idx === 0) {
      this.aegisTimer = 30;
      this.aegisShieldHp = 600;
      this.ternCooldowns[0] = 120;
      this.toast('Tern Aegis Dome deployed (600 shield for 30s).');
    } else if (idx === 1) {
      this.overwatchTimer = 25;
      this.ternCooldowns[1] = 90;
      this.toast('Tern Overwatch active (40 DPS within 60m for 25s).');
    } else {
      this.giveItem('plasma_cell_pack', 2);
      this.giveItem('medkit', 1);
      this.giveItem('ration_bar', 1);
      this.ternCooldowns[2] = 300;
      this.toast('Tern Resupply Drop delivered (+2 Cell Packs, +1 Medkit, +1 Ration Bar).');
    }
    sound.playOrrinChord();
    this.activeModal = null;
    this.paused = false;
    this.emitSnapshot();
  }

  public solvePuzzle(puzzleId: 'aux_power' | 'coolant_loop' | 'glyph_door' | 'core_terminal', payload?: string) {
    if (puzzleId === 'aux_power') {
      if (!this.ownedTools.repair && !this.creative) return this.toast('Requires Repair Tool.');
      if (!this.hasItems({ cu_wire: 2 }) && !this.creative) return this.toast('Needs 2 Copper Wire.');
      if (!this.creative) this.consumeItems({ cu_wire: 2 });
      this.flags.auxPowerFixed = true;
      this.unlockedIds.add('u_hangar_upper');
      this.completeMission('2.03', '2.07');
      sound.playPickup();
      this.toast('Auxiliary Power restored! Unlocked Stingray, Hover Skiff, Vehicle Bay & upgrades.');
    } else if (puzzleId === 'coolant_loop') {
      if (payload === 'fail') {
        this.radiation = Math.min(100, this.radiation + 25);
        this.hurtPlayer(10);
        return this.toast('Wrong valve sequence! Radiation spike (+25%). Follow Menon’s log: Bypass (B) -> Primary (A) -> Return (C).');
      }
      this.flags.coolantFixed = true;
      this.flags.reactorPowerOn = true;
      this.giveItem('energy_cell', 6);
      this.completeMission('2.09', '2.10');
      sound.playPickup();
      this.toast('Coolant Loop stabilized! Repuls Main Power online & Reactor Rod (+6 Energy Cells) recovered.');
    } else if (puzzleId === 'glyph_door') {
      if (payload === 'fail') {
        this.hurtPlayer(8);
        return this.toast('Glyph mismatch! Check Orrin Mural I: Spiral -> Ring -> Spiral-in-Ring.');
      }
      this.flags.glyphDoorOpened = true;
      this.unlockedIds.add('u_alien_fab');
      this.unlockedIds.add('u_waystation_murals');
      this.completeMission('2.12', '3.01');
      sound.playOrrinChord();
      this.toast('Glyph Door opened! Unlocked Alien Fabricator, Resonance Plating & Pressure Lattice.');
    } else if (puzzleId === 'core_terminal') {
      if (payload === 'disable') {
        this.triggerEnding('quiet_tide');
      } else if (payload === 'destroy') {
        this.escapeTimer = 120;
        this.triggerEnding('last_light');
      }
    }
    this.activeModal = null;
    this.paused = false;
    this.emitSnapshot();
  }

  private triggerEnding(end: 'quiet_tide' | 'last_light') {
    this.ending = end;
    this.flags.custodianPhase = 5;
    this.paused = true;
    this.completeMission('3.09');
    sound.playOrrinChord();
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.emitSnapshot();
  }

  public continueFreeRoam() {
    this.ending = null;
    this.freeRoamAfterEnd = true;
    this.paused = false;
    this.escapeTimer = 0;
    this.px = LANDMARKS.lifepod07.x;
    this.pz = LANDMARKS.lifepod07.z + 0.7;
    this.py = this.lifepodY + 1.95;
    this.inLifepod = true;
    this.toast('Returned to Lifepod 07 in Free Roam.');
    this.emitSnapshot();
  }

  public setActiveWaypoint(wp: { x: number; y: number; z: number; label: string } | null) {
    this.activeWaypoint = wp;
    this.emitSnapshot();
  }

  public warpTo(x: number, z: number) {
    if (!this.creative) return;
    const h = terrainHeightAt(x, z);
    this.px = x;
    this.pz = z;
    this.py = h < -10 ? h + 8 : h + 2.5;
    this.vel.set(0, 0, 0);
    if (this.pilotingId) {
      const v = this.getPiloted();
      if (v) {
        v.x = this.px;
        v.y = this.py;
        v.z = this.pz;
      }
    }
    this.activeModal = null;
    this.paused = false;
    this.toast(`Warped to ${getCellCoords(x, z).code}`);
    this.emitSnapshot();
  }

  public togglePilot() {
    if (this.pilotingId) {
      const v = this.getPiloted();
      this.pilotingId = null;
      if (v) {
        this.px = v.x + 3.5;
        this.py = Math.max(terrainHeightAt(this.px, v.z) + 1.8, v.y + 1);
        this.pz = v.z;
      }
      this.refreshViewModel();
      this.toast('Exited vehicle.');
      this.emitSnapshot();
      return;
    }

    // Find closest vehicle within 14m
    let best: VehicleState | null = null;
    let bestD = 14;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.x - this.px, v.y - this.py, v.z - this.pz);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (!best) return this.toast('No vehicle within reach (build one at a Vehicle Bay).');
    this.pilotingId = best.id;
    this.px = best.x;
    this.py = best.y;
    this.pz = best.z;
    this.refreshViewModel();
    this.toast(`Piloting ${best.name}.`);
    this.emitSnapshot();
  }

  public toggleVehicleLights() {
    const v = this.getPiloted();
    if (!v) return;
    v.lightsOn = !v.lightsOn;
    this.toast(v.lightsOn ? 'Vehicle headlights ON' : 'Vehicle headlights OFF (stealth mode)');
    this.emitSnapshot();
  }

  public activateVehicleBoost() {
    const piloted = this.getPiloted();
    if (!piloted) return;
    if (piloted.type === 'prawn') {
      const floorY = terrainHeightAt(this.px, this.pz);
      if (this.py > floorY + 6.5) return;
      const jumpPower = piloted.upgrades.thrusterMod ? 13.5 : 9.2;
      this.vel.y = jumpPower;
      const fwdX = -Math.sin(this.yaw);
      const fwdZ = -Math.cos(this.yaw);
      this.vel.x += fwdX * 4;
      this.vel.z += fwdZ * 4;
      sound.playScan();
      this.emitSnapshot();
      return;
    }

    if (piloted.boostCd > 0) return this.toast(`Boost cooling down (${Math.ceil(piloted.boostCd)}s).`);
    if (!this.creative && piloted.power < 6) return this.toast('Insufficient vehicle power for Boost.');
    if (!this.creative) piloted.power = Math.max(0, piloted.power - 6);

    const hasUpgradedBoost = piloted.type === 'hover_skiff' && piloted.upgrades.skiffBoost;
    piloted.boostActive = hasUpgradedBoost ? 4.5 : 3.2;
    piloted.boostCd = hasUpgradedBoost ? 12 : 14;
    sound.playScan();
    this.toast(`${piloted.name} Boost engaged!`);
    this.emitSnapshot();
  }

  public repairAndChargeVehicle(vehicleId: string) {
    const v = this.vehicles.find((veh) => veh.id === vehicleId);
    if (!v) return;
    const nearBay = this.bases.some((b) => b.type === 'vehicle_bay' && Math.hypot(b.x - v.x, b.z - v.z) < 40);
    if (!this.creative && !nearBay && this.basePower < 20) {
      return this.toast('Move within 40m of a Vehicle Bay or ensure 20 PU Base Power.');
    }
    if (!this.creative && !nearBay) this.basePower = Math.max(0, this.basePower - 20);
    v.hp = v.maxHp;
    v.power = v.maxPower;
    sound.playPickup();
    this.toast(`${v.name} hull repaired & power cells recharged.`);
    this.emitSnapshot();
  }

  public transferCargoToVehicle(vehicleId: string, item: ItemId, qty = 1) {
    const v = this.vehicles.find((veh) => veh.id === vehicleId);
    if (!v) return;
    if ((this.inventory[item] ?? 0) < qty) return;
    const usedCargo = Object.values(v.cargo).reduce((a, b) => a + (b ?? 0), 0);
    if (usedCargo + qty > v.cargoCap) {
      return this.toast(`${v.name} cargo hold full (${usedCargo}/${v.cargoCap}).`);
    }
    this.consumeItems({ [item]: qty });
    v.cargo[item] = (v.cargo[item] ?? 0) + qty;
    sound.playPickup();
    this.emitSnapshot();
  }

  public transferCargoFromVehicle(vehicleId: string, item: ItemId, qty = 1) {
    const v = this.vehicles.find((veh) => veh.id === vehicleId);
    if (!v || (v.cargo[item] ?? 0) < qty) return;
    v.cargo[item] = (v.cargo[item] ?? 0) - qty;
    if ((v.cargo[item] ?? 0) <= 0) delete v.cargo[item];
    this.giveItem(item, qty);
    sound.playPickup();
    this.emitSnapshot();
  }

  // ---- Internal helpers ----

  private createNewVehicle(type: VehicleType) {
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const vx = this.px + fwdX * 8;
    const vz = this.pz + fwdZ * 8;
    const vy = type === 'hover_skiff' ? Math.max(0.8, terrainHeightAt(vx, vz) + 0.9) : Math.min(-2.5, Math.max(terrainHeightAt(vx, vz) + 3, this.py));

    const defs: Record<VehicleType, Omit<VehicleState, 'id' | 'x' | 'y' | 'z' | 'yaw' | 'lightsOn' | 'cargo' | 'cargoCap' | 'upgrades' | 'maelstromAmmo' | 'maelstromReload' | 'boostCd' | 'boostActive'>> = {
      stingray: { type: 'stingray', name: 'Stingray Scout Sub', hp: 100, maxHp: 100, power: 100, maxPower: 100, crushDepth: 250, speed: 7, strafeSpeed: 5 },
      hover_skiff: { type: 'hover_skiff', name: 'Hover Skiff', hp: 75, maxHp: 75, power: 80, maxPower: 80, crushDepth: 10, speed: 6, strafeSpeed: 4 },
      prawn: { type: 'prawn', name: 'PRAWN Exosuit', hp: 300, maxHp: 300, power: 200, maxPower: 200, crushDepth: 400, speed: 4, strafeSpeed: 3.5 },
      bulwark: { type: 'bulwark', name: 'Bulwark Armored Sub', hp: 650, maxHp: 650, power: 400, maxPower: 400, crushDepth: 900, speed: 5, strafeSpeed: 3 },
    };
    const base = defs[type];
    const state: VehicleState = {
      id: `veh_${Date.now()}_${Math.random()}`,
      ...base,
      cargoCap: type === 'stingray' ? 6 : type === 'hover_skiff' ? 4 : type === 'prawn' ? 12 : 8,
      x: vx,
      y: vy,
      z: vz,
      yaw: this.yaw,
      lightsOn: true,
      cargo: {},
      upgrades: {
        depthMk: 0,
        pressureLattice: false,
        speedMod: false,
        storageMod: false,
        powerCellMk2: false,
        resonancePlating: false,
        skiffBoost: false,
        drillArm: false,
        grabberArm: false,
        thrusterMod: false,
        cargoRack: false,
        maelstrom: false,
      },
      maelstromAmmo: 9,
      maelstromReload: 0,
      boostCd: 0,
      boostActive: 0,
    };
    this.spawnVehicleState(state);
    if (type === 'prawn') this.completeMission('2.13', '3.01');
  }

  private spawnVehicleState(v: VehicleState) {
    this.vehicles.push(v);
    const mesh = buildVehicleModel(v.type);
    mesh.position.set(v.x, v.y, v.z);
    mesh.rotation.y = v.yaw;
    this.scene.add(mesh);
    this.vehicleMeshes.set(v.id, mesh);
  }

  private applyVehicleUpgrade(mod: ItemId) {
    for (const v of this.vehicles) {
      if (mod === 'depth_mk1' && (v.type === 'stingray' || v.type === 'prawn') && v.upgrades.depthMk < 1) {
        v.upgrades.depthMk = 1;
        v.crushDepth = (v.type === 'stingray' ? 250 : 400) + 100;
      } else if (mod === 'depth_mk2' && (v.type === 'stingray' || v.type === 'prawn')) {
        v.upgrades.depthMk = 2;
        v.crushDepth = (v.type === 'stingray' ? 250 : 400) + 200;
      } else if (mod === 'pressure_lattice' && v.type === 'prawn') {
        v.upgrades.pressureLattice = true;
        v.crushDepth = 700;
      } else if (mod === 'speed_mod' && (v.type === 'stingray' || v.type === 'hover_skiff') && !v.upgrades.speedMod) {
        v.upgrades.speedMod = true;
        v.speed += v.type === 'stingray' ? 1.5 : 1.0;
      } else if (mod === 'storage_mod' && (v.type === 'stingray' || v.type === 'bulwark') && !v.upgrades.storageMod) {
        v.upgrades.storageMod = true;
        v.cargoCap += 4;
      } else if (mod === 'power_cell_mk2' && !v.upgrades.powerCellMk2) {
        v.upgrades.powerCellMk2 = true;
        v.maxPower = Math.round(v.maxPower * 1.5);
        v.power = v.maxPower;
      } else if (mod === 'resonance_plating' && !v.upgrades.resonancePlating) {
        v.upgrades.resonancePlating = true;
        v.maxHp = Math.round(v.maxHp * 1.25);
        v.hp = v.maxHp;
      } else if (mod === 'skiff_boost' && v.type === 'hover_skiff') {
        v.upgrades.skiffBoost = true;
      } else if (mod === 'prawn_drill' && v.type === 'prawn') v.upgrades.drillArm = true;
      else if (mod === 'prawn_grabber' && v.type === 'prawn') v.upgrades.grabberArm = true;
      else if (mod === 'prawn_thruster' && v.type === 'prawn') v.upgrades.thrusterMod = true;
      else if (mod === 'prawn_cargo' && v.type === 'prawn' && !v.upgrades.cargoRack) {
        v.upgrades.cargoRack = true;
        v.cargoCap += 4;
      } else if (mod === 'maelstrom' && v.type === 'bulwark') {
        v.upgrades.maelstrom = true;
      }
    }
  }

  private placeBaseState(b: BasePieceState) {
    this.bases.push(b);
    const mesh = buildBaseStructure(b.type);
    mesh.position.set(b.x, b.y, b.z);
    mesh.rotation.y = b.yaw;
    this.scene.add(mesh);
    this.baseMeshes.set(b.id, mesh);

    if (b.type === 'small_hab' || b.type === 'large_hab') {
      const light = new THREE.PointLight(0xd9f4ff, 2.2, b.type === 'large_hab' ? 16 : 11);
      light.position.set(b.x, b.y + (b.type === 'large_hab' ? 3.5 : 2.7), b.z);
      this.scene.add(light);
      this.baseLights.set(b.id, light);
    }

    if (b.type === 'tern_pad') {
      this.ternPadBuilt = true;
      if (this.ternRestored) {
        this.ternMesh.visible = true;
        this.ternMesh.position.set(b.x, b.y + 1.2, b.z);
      }
    }
  }

  private getPiloted(): VehicleState | null {
    if (!this.pilotingId) return null;
    return this.vehicles.find((v) => v.id === this.pilotingId) ?? null;
  }

  private recomputeO2Max() {
    const base = this.tankTier === 1 ? 75 : this.tankTier === 2 ? 120 : 180;
    this.o2Max = base + (this.suitTier === 'reinforced' ? 20 : 0);
    this.o2 = Math.min(this.o2Max, this.o2 + 20);
  }

  private hasItems(req: Partial<Record<ItemId, number>>): boolean {
    for (const [k, v] of Object.entries(req)) {
      if ((this.inventory[k as ItemId] ?? 0) < (v ?? 0)) return false;
    }
    return true;
  }

  private consumeItems(req: Partial<Record<ItemId, number>>) {
    for (const [k, v] of Object.entries(req)) {
      const id = k as ItemId;
      this.inventory[id] = Math.max(0, (this.inventory[id] ?? 0) - (v ?? 0));
      if (this.inventory[id] === 0) delete this.inventory[id];
    }
  }

  private giveItem(id: ItemId, qty: number) {
    this.inventory[id] = (this.inventory[id] ?? 0) + qty;
  }

  private discoverLog(id: string) {
    if (!this.discoveredLogs.has(id)) {
      this.discoveredLogs.add(id);
      const log = LOGS.find((l) => l.id === id);
      if (log) {
        this.recentUnlock = { title: 'AUDIO LOG RECOVERED', subtitle: log.title };
        this.recentUnlockTimer = 4.5;
      }
    }
  }

  private completeMission(id: string, nextId?: string) {
    this.completedMissions.add(id);
    if (nextId && !this.completedMissions.has(nextId)) {
      this.activeMissionId = nextId;
      const m = MISSIONS.find((ms) => ms.id === nextId);
      if (m?.waypoint) this.activeWaypoint = m.waypoint;
    }
  }

  private refreshViewModel() {
    if (this.viewModelGroup) {
      this.camera.remove(this.viewModelGroup);
      this.viewModelGroup = null;
    }
    if (this.cockpitGroup) {
      this.camera.remove(this.cockpitGroup);
      this.cockpitGroup = null;
    }
    for (const [id, mesh] of this.vehicleMeshes.entries()) {
      mesh.visible = id !== this.pilotingId;
    }
    const piloted = this.getPiloted();
    if (piloted) {
      this.cockpitGroup = buildVehicleCockpit(piloted.type);
      this.camera.add(this.cockpitGroup);
      return;
    }
    if (this.holstered) return;
    this.viewModelGroup = buildViewModel(this.tool, this.weapon);
    this.viewModelGroup.position.set(0.28, -0.24, -0.48);
    this.camera.add(this.viewModelGroup);
  }

  private toast(msg: string) {
    this.toastText = msg;
    this.toastTimer = 3.2;
  }

  private hurtPlayer(dmg: number) {
    if (this.creative || this.ending) return;
    if (this.aegisTimer > 0 && this.aegisShieldHp > 0) {
      this.aegisShieldHp = Math.max(0, this.aegisShieldHp - dmg);
      return;
    }
    const v = this.getPiloted();
    if (v) {
      const mult = v.type === 'bulwark' ? 0.75 : 1;
      v.hp -= dmg * mult;
      sound.playHurt();
      if (v.hp <= 0) {
        v.hp = 0;
        this.pilotingId = null;
        this.refreshViewModel();
        this.toast(`${v.name} disabled! Reclaim or repair at Vehicle Bay.`);
      }
      return;
    }
    const suitMult = this.suitTier === 'reinforced' && this.suitIntegrity > 25 ? 0.75 : 1;
    this.hp -= dmg * suitMult;
    this.suitIntegrity = Math.max(0, this.suitIntegrity - dmg * 0.25);
    sound.playHurt();
  }

  // ---- Input & Interaction ----

  private bindEvents() {
    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (!this.started || this.activeModal || this.ending) {
        if (e.code === 'Escape' && this.activeModal) this.openModal(null);
        return;
      }
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;

      if (this.intro) {
        if (e.code === 'KeyE') this.interact();
        return;
      }

      if (e.code === 'KeyE') this.interact();
      else if (e.code === 'KeyF') this.scanning = true;
      else if (e.code === 'KeyB') this.openModal({ type: 'station', station: 'builder' });
      else if (e.code === 'KeyI') this.openModal({ type: 'inventory' });
      else if (e.code === 'Tab' || e.code === 'KeyJ') {
        this.openModal({ type: 'databank', tab: 'missions' });
      } else if (e.code === 'KeyT') this.openModal({ type: 'tern' });
      else if (e.code === 'KeyQ' && this.buildingMode) this.rotateBuildGhost(-45);
      else if (e.code === 'KeyR') {
        if (this.buildingMode) this.rotateBuildGhost(45);
        else this.startReload();
      } else if (e.code === 'KeyG' && this.deconstructTarget) this.deconstructTargetPiece();
      else if (e.code === 'KeyX') this.toggleHolster();
      else if (e.code === 'KeyC') {
        const floorY = terrainHeightAt(this.px, this.pz);
        const swimmingNow = this.py < -0.15 || (floorY < -0.6 && this.py <= 1.35);
        if (!swimmingNow && !this.pilotingId) {
          this.crouching = !this.crouching;
          this.toast(this.crouching ? 'Crouching (noise halved)' : 'Standing');
        }
      } else if (e.code === 'KeyL') this.toggleVehicleLights();
      else if (e.code === 'KeyV') this.togglePilot();
      else if (e.code === 'Digit1') this.selectWeapon('plasma_rifle');
      else if (e.code === 'Digit2') this.selectWeapon('pulse_shotgun');
      else if (e.code === 'Digit3') this.selectWeapon('ion_sniper');
      else if (e.code === 'Digit4') this.setTool('scanner');
      else if (e.code === 'Digit5') this.setTool('repair');
      else if (e.code === 'Digit6') this.setTool('cutter');
      else if (e.code === 'Digit7') this.setTool('builder');
      else if (e.code === 'Escape') {
        if (this.buildingMode) this.setBuildingMode(null);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyF') {
        this.scanning = false;
        this.scanProgress = 0;
        this.scanTargetName = null;
      }
    };

    const canvas = this.renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      if (!this.started || this.activeModal || this.ending) return;
      if (e.pointerType === 'mouse') {
        this.mouseDragActive = true;
        this.mouseDragMoved = false;
        this.mouseButton = e.button;
        this.mouseDownX = e.clientX;
        this.mouseDownY = e.clientY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        if (document.pointerLockElement === canvas) {
          if (this.buildingMode && e.button === 0) {
            this.tryPlaceBuilding();
            return;
          }
          if (e.button === 2) {
            this.scanning = true;
          } else if (e.button === 0) {
            if (this.tool === 'scanner' && !this.holstered) this.scanning = true;
            else this.firing = true;
          }
        } else {
          if (e.button === 2) {
            this.scanning = true;
          } else if (e.button === 0 && !this.buildingMode) {
            try {
              const maybePromise = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
              if (maybePromise && typeof maybePromise.catch === 'function') {
                maybePromise.catch(() => {});
              }
            } catch {
              // Pointer lock blocked in iframe; smooth click-drag look handles camera
            }
          }
        }
      } else {
        if (this.touchLookId === null) {
          this.touchLookId = e.pointerId;
          this.lastTouchX = e.clientX;
          this.lastTouchY = e.clientY;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.started || this.activeModal || this.ending) return;
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement === canvas) {
          this.yaw -= e.movementX * 0.0022;
          this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch - e.movementY * 0.0022));
        } else if (this.mouseDragActive) {
          const dx = e.clientX - this.lastMouseX;
          const dy = e.clientY - this.lastMouseY;
          if (Math.hypot(e.clientX - this.mouseDownX, e.clientY - this.mouseDownY) > 4) {
            this.mouseDragMoved = true;
          }
          this.yaw -= dx * 0.0035;
          this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch - dy * 0.0035));
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;
        }
      } else if (e.pointerId === this.touchLookId) {
        this.yaw -= (e.clientX - this.lastTouchX) * 0.0048;
        this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch - (e.clientY - this.lastTouchY) * 0.0048));
        this.lastTouchX = e.clientX;
        this.lastTouchY = e.clientY;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement !== canvas && this.mouseDragActive && !this.mouseDragMoved && this.started && !this.activeModal && !this.ending) {
          if (this.mouseButton === 0) {
            if (this.buildingMode) this.tryPlaceBuilding();
            else if (!this.holstered) this.fireActiveWeapon();
          }
        }
        this.mouseDragActive = false;
        if (e.button === 0) {
          this.firing = false;
          if (this.tool === 'scanner') {
            this.scanning = false;
            this.scanProgress = 0;
            this.scanTargetName = null;
          }
        }
        if (e.button === 2) {
          this.scanning = false;
          this.scanProgress = 0;
          this.scanTargetName = null;
        }
      }
      if (e.pointerId === this.touchLookId) this.touchLookId = null;
    };

    const onWheel = (e: WheelEvent) => {
      if (!this.started || this.activeModal || this.ending) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) > 2) {
        this.cycleSlot(e.deltaY > 0 ? 1 : -1);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onLockChange = () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (!this.pointerLocked) {
        this.firing = false;
        this.scanning = false;
        this.scanProgress = 0;
        this.scanTargetName = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    document.addEventListener('pointerlockchange', onLockChange);

    this.cleanupListeners = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }
  private cleanupListeners = () => {};

  public interact() {
    if (!this.started || this.activeModal || this.ending) return;

    if (this.intro) {
      if (this.intro.phase === 'evacuate' && this.pz <= -6.8) {
        this.beginIntroEjection();
      }
      return;
    }

    // 1. Building placement
    if (this.buildingMode) {
      this.tryPlaceBuilding();
      return;
    }

    // 2. Cache recovery beacon
    if (this.cacheLoot && Math.hypot(this.px - this.cachePos.x, this.pz - this.cachePos.z) < 8) {
      for (const [k, v] of Object.entries(this.cacheLoot)) {
        this.giveItem(k as ItemId, v ?? 0);
      }
      this.cacheLoot = null;
      this.cacheBeaconMesh.visible = false;
      sound.playPickup();
      this.toast('Recovered dropped items from Cache Beacon.');
      this.emitSnapshot();
      return;
    }

    // 3. Nearest hotspot (Repuls, Lifepod, Waystations, Heartspire)
    if (this.nearestHotspot) {
      this.nearestHotspot.action();
      this.emitSnapshot();
      return;
    }

    // 4. Nearest Base Piece
    for (const b of this.bases) {
      const d = Math.hypot(b.x - this.px, b.y - this.py, b.z - this.pz);
      if (d < 8) {
        if (b.disabledTimer > 0) {
          if (!this.ownedTools.repair && !this.creative) return this.toast('Module disabled by Seeker raid! Craft Repair Tool.');
          b.disabledTimer = 0;
          sound.playPickup();
          return this.toast('Base module repaired!');
        }
        if (b.type === 'std_fab') return this.openModal({ type: 'station', station: 'standard' });
        if (b.type === 'workbench') return this.openModal({ type: 'station', station: 'workbench' });
        if (b.type === 'vehicle_bay') {
          // Recharge & repair nearby vehicles
          for (const v of this.vehicles) {
            if (Math.hypot(v.x - b.x, v.z - b.z) < 35) {
              v.hp = v.maxHp;
              v.power = v.maxPower;
            }
          }
          return this.openModal({ type: 'station', station: 'vehicle_bay' });
        }
        if (b.type === 'alien_fab') {
          if (!this.flags.blackBoxDecoded) {
            this.decodeBlackBox();
          }
          return this.openModal({ type: 'station', station: 'alien' });
        }
        if (b.type === 'hydroponics') {
          if (b.cropReady > 0) {
            this.giveItem('gourd', 2);
            this.giveItem('bloomfruit', 2);
            this.giveItem('hydro_cane', 2);
            b.cropReady = 0;
            sound.playPickup();
            return this.toast('Harvested Hydroponics: +2 Gourds, +2 Bloomfruit, +2 Hydro Cane.');
          }
          return this.toast(`Hydroponics growing (${Math.round(b.cropProgress * 100)}%).`);
        }
        if (b.type === 'water_fab') {
          this.hydration = 100;
          this.giveItem('hydro_gel', 2);
          sound.playPickup();
          return this.toast('Hydration restored (+2 Hydro Gel).');
        }
        if (b.type === 'med_bay') {
          if (this.basePower >= 20 || this.creative) {
            if (!this.creative) this.basePower -= 20;
            this.hp = this.maxHp;
            sound.playPickup();
            return this.toast('Med Bay restored Health to 100.');
          }
          return this.toast('Med Bay needs 20 PU.');
        }
        if (b.type === 'bunk') {
          this.cycleMinutes = 8; // skip to morning
          this.hp = this.maxHp;
          this.respawnPos.set(b.x, b.y + 1.5, b.z + 2);
          sound.playOrrinChord();
          return this.toast('Slept until morning. Health restored & respawn set.');
        }
        if (b.type === 'work_terminal') return this.openModal({ type: 'databank', tab: 'logs' });
        if (b.type === 'storage_locker' || b.type === 'wall_locker') return this.openModal({ type: 'inventory' });
        if (b.type === 'tern_pad') return this.openModal({ type: 'tern' });
      }
    }

    // 5. Enter/Exit nearby vehicle
    for (const v of this.vehicles) {
      if (Math.hypot(v.x - this.px, v.y - this.py, v.z - this.pz) < 10) {
        this.togglePilot();
        return;
      }
    }

    // 6. Gather nearest Resource Node
    const lookDir = _v1.set(0, 0, -1).applyEuler(_euler.set(this.pitch, this.yaw, 0, 'YXZ'));
    let bestNode: ResourceNode | null = null;
    let bestScore = 0.35;
    for (const n of this.nodes) {
      if (n.regrowTimer > 0) continue;
      const dx = n.x - this.px;
      const dy = n.y - this.py;
      const dz = n.z - this.pz;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 10) continue;
      const dot = (dx * lookDir.x + dy * lookDir.y + dz * lookDir.z) / Math.max(0.01, dist);
      if (dot > bestScore) {
        bestScore = dot;
        bestNode = n;
      }
    }

    if (bestNode) {
      const piloted = this.getPiloted();
      if (bestNode.hardened && !(piloted?.type === 'prawn' && piloted.upgrades.drillArm) && !this.creative) {
        return this.toast('Hardened Trench vein! Requires PRAWN Drill Arm.');
      }
      const bonus = piloted?.type === 'prawn' && piloted.upgrades.drillArm ? 1 : 0;
      const qty = bestNode.amount + bonus;
      this.giveItem(bestNode.item, qty);
      if (bestNode.item === 'po_ore') this.unlockedIds.add('u_plasteel');
      if (bestNode.item === 'hydro_crystal') this.unlockedIds.add('u_hydro');
      if (bestNode.item === 'sup_ore') this.unlockedIds.add('u_sup_fil');
      if (bestNode.item === 'bio_stabilizer') this.completeMission('3.03');

      if (bestNode.renewable) {
        bestNode.regrowTimer = bestNode.item === 'energy_cell' ? 1800 : 1200;
        bestNode.mesh.visible = false;
      } else {
        this.scene.remove(bestNode.mesh);
        this.nodes.splice(this.nodes.indexOf(bestNode), 1);
      }
      sound.playPickup();
      this.toast(`+${qty} ${ITEMS[bestNode.item].name}`);
      this.emitSnapshot();
      return;
    }

    this.toast('Nothing in reach.');
  }

  private tryPlaceBuilding() {
    if (!this.buildingMode) return;
    if (!this.buildingValid) return this.toast('Invalid placement site (too close to Repuls, deep mismatch, or missing materials).');
    const rec = RECIPES.find((r) => r.output === this.buildingMode && r.station === 'builder');
    if (!rec) return;
    if (!this.creative && !this.hasItems(rec.ingredients)) return this.toast('Missing materials.');
    if (!this.creative) this.consumeItems(rec.ingredients);

    const bType = this.buildingMode as BasePieceState['type'];
    const piece: BasePieceState = {
      id: `base_${Date.now()}_${Math.random()}`,
      type: bType,
      x: this.buildPos.x,
      y: this.buildPos.y,
      z: this.buildPos.z,
      yaw: this.yaw + this.buildingYaw,
      disabledTimer: 0,
      cropProgress: 0,
      cropReady: 0,
      waterTimer: 0,
    };
    this.placeBaseState(piece);
    sound.playPickup();
    this.toast(`Built ${ITEMS[this.buildingMode].name}!`);

    if (bType === 'small_hab') {
      this.unlockedIds.add('u_hab_advanced');
      this.completeMission('1.06', '1.07');
    }
    this.setBuildingMode(null);
  }

  private startReload() {
    if (this.pilotingId) return;
    const stats = WEAPONS[this.weapon];
    const maxMag = this.weapon === 'plasma_rifle' && this.hasExtMag ? 40 : stats.magSize;
    if (this.magAmmo[this.weapon] >= maxMag) return;
    if (!this.creative && !this.hasItems({ [stats.ammoType]: 1 })) {
      return this.toast(`No ${ITEMS[stats.ammoType].name} in inventory.`);
    }
    this.reloadTimer = this.weapon === 'plasma_rifle' && this.hasExtMag ? 2.2 : stats.reloadTime;
    sound.playScan();
    this.toast(`Reloading ${stats.name}...`);
  }

  private fireActiveWeapon() {
    if (this.fireCd > 0 || this.reloadTimer > 0) return;

    // Bulwark Maelstrom Supergun
    const piloted = this.getPiloted();
    if (piloted) {
      if (piloted.type !== 'bulwark' || !piloted.upgrades.maelstrom) return;
      if (piloted.maelstromAmmo <= 0) {
        if (!this.creative && !this.hasItems({ energy_cell: 1 })) return this.toast('Maelstrom empty (needs Energy Cell).');
        if (!this.creative) this.consumeItems({ energy_cell: 1 });
        piloted.maelstromAmmo = 3;
        piloted.maelstromReload = 4;
        return this.toast('Loading Maelstrom Supergun (4s)...');
      }
      if (piloted.maelstromReload > 0) return;
      this.fireCd = 2.0; // 0.5 shots/s
      if (!this.creative) {
        piloted.maelstromAmmo--;
        piloted.power = Math.max(0, piloted.power - 4);
      }
      this.noiseRadius = Math.max(this.noiseRadius, 150);
      sound.playWeapon('maelstrom');
      this.raycastProjectile(300, 250, 0, true);
      return;
    }

    if (this.holstered) return;
    if (this.tool === 'builder') {
      this.fireCd = 0.35;
      this.firing = false;
      if (this.buildingMode) this.tryPlaceBuilding();
      else this.openModal({ type: 'station', station: 'builder' });
      return;
    }
    if (this.tool === 'repair' || this.tool === 'cutter') {
      this.fireCd = 0.35;
      this.firing = false;
      this.interact();
      return;
    }
    if (this.tool !== 'weapon') return;
    const stats = WEAPONS[this.weapon];
    if (this.magAmmo[this.weapon] <= 0) {
      this.startReload();
      return;
    }

    this.fireCd = 1 / stats.fireRate;
    this.viewKick = 0.14;
    if (!this.creative) this.magAmmo[this.weapon]--;

    const uw = this.py < -0.4;
    let dmg = stats.damage * (uw ? stats.uwDamageMult : 1);
    if (this.weapon === 'plasma_rifle' && this.hasSuppressor) dmg *= 0.9;
    const range = stats.maxRange * (uw ? stats.uwRangeMult : 1);

    let nz = stats.noiseRadius;
    if (this.weapon === 'plasma_rifle' && this.hasSuppressor) nz *= 0.6;
    if (uw) nz *= 1.5;
    if (this.weather === 'Rain' && getBiomeAt(this.px, this.pz) === 'jungle_coast') nz *= 0.7;
    this.noiseRadius = Math.max(this.noiseRadius, nz);

    sound.playWeapon(this.weapon, this.weapon === 'plasma_rifle' && this.hasSuppressor);
    this.raycastProjectile(range, dmg, stats.spreadDeg, false, this.weapon === 'pulse_shotgun', stats.weakPointMult);
  }

  private raycastProjectile(range: number, dmg: number, spreadDeg: number, isMaelstrom: boolean, isCone = false, weakMult = 1.2) {
    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    const dir = _v1.set(0, 0, -1).applyEuler(_euler);
    const origin = _v2.set(this.px, this.py, this.pz);

    if (spreadDeg > 0 && !isCone) {
      const s = THREE.MathUtils.degToRad(spreadDeg);
      dir.x += (Math.random() - 0.5) * s;
      dir.y += (Math.random() - 0.5) * s;
      dir.z += (Math.random() - 0.5) * s;
      dir.normalize();
    }

    let hitSomething = false;
    let closestDist = range;
    let closestTarget: CreatureEntity | null = null;

    // Cone shotgun hits all targets within cone & range
    for (const c of this.creatures) {
      if (c.dead) continue;
      _v3.set(c.x - origin.x, c.y - origin.y, c.z - origin.z);
      const t = _v3.dot(dir);
      if (t < 0 || t > range) continue;
      const perpSq = _v3.lengthSq() - t * t;
      const hitRad = isCone ? c.radius + t * 0.24 : c.radius + 0.6;
      if (perpSq <= hitRad * hitRad) {
        if (isCone) {
          this.damageCreature(c, dmg, true);
          hitSomething = true;
        } else if (t < closestDist) {
          closestDist = t;
          closestTarget = c;
        }
      }
    }

    if (closestTarget) {
      const finalDmg = closestTarget.vulnerableTimer > 0 ? dmg * 1.5 : dmg * (Math.random() < 0.25 ? weakMult : 1);
      this.damageCreature(closestTarget, finalDmg, false);
      hitSomething = true;
      if (isMaelstrom) {
        for (const other of this.creatures) {
          if (!other.dead && other !== closestTarget && Math.hypot(other.x - closestTarget.x, other.y - closestTarget.y, other.z - closestTarget.z) < 8) {
            this.damageCreature(other, 50, false);
          }
        }
      }
    }

    // Check Custodian / Phase 2 Anchors in Heartspire
    if (this.flags.custodianPhase >= 1 && this.flags.custodianPhase <= 4) {
      const hsY = terrainHeightAt(LANDMARKS.heartspire.x, LANDMARKS.heartspire.z);
      if (this.flags.custodianPhase === 2) {
        for (let i = 0; i < 3; i++) {
          if (this.anchorHp[i] <= 0) continue;
          const m = this.heartspire.anchorMeshes[i];
          const ax = LANDMARKS.heartspire.x + m.position.x;
          const ay = hsY + m.position.y;
          const az = LANDMARKS.heartspire.z + m.position.z;
          _v3.set(ax - origin.x, ay - origin.y, az - origin.z);
          const t = _v3.dot(dir);
          if (t > 0 && t < range && _v3.lengthSq() - t * t < 9) {
            this.anchorHp[i] = Math.max(0, this.anchorHp[i] - dmg);
            hitSomething = true;
            if (this.anchorHp[i] <= 0) {
              m.visible = false;
              this.toast('Anchor destroyed!');
            }
            if (this.anchorHp.every((h) => h <= 0)) {
              this.flags.custodianPhase = 3;
              this.flags.echoSpeechTimer = 90;
              this.heartspire.echoMesh.visible = true;
              sound.playOrrinChord();
              this.toast("Captain Varga's Echo appears!");
            }
          }
        }
      } else if (this.flags.custodianPhase === 1 || this.flags.custodianPhase === 4) {
        const cx = LANDMARKS.heartspire.x;
        const cy = hsY + 14;
        const cz = LANDMARKS.heartspire.z;
        _v3.set(cx - origin.x, cy - origin.y, cz - origin.z);
        const t = _v3.dot(dir);
        if (t > 0 && t < range && _v3.lengthSq() - t * t < 36) {
          const mult = this.flags.custodianPhase === 4 || this.flags.custodianExposed ? weakMult : 0.6;
          this.flags.custodianHp = Math.max(0, this.flags.custodianHp - dmg * mult);
          hitSomething = true;
          if (this.flags.custodianHp <= 0) {
            if (this.flags.custodianPhase === 1) {
              this.flags.custodianPhase = 2;
              this.anchorHp = [500, 500, 500];
              this.toast('Phase 2: Custodian shielded! Destroy the 3 platform Anchors!');
            } else if (this.flags.custodianPhase === 4) {
              this.escapeTimer = 120;
              this.triggerEnding('last_light');
            }
          }
        }
      }
    }

    // Visual tracer
    const end = origin.clone().addScaledVector(dir, hitSomething ? closestDist : Math.min(range, 70));
    const start = origin.clone().addScaledVector(dir, 1.2);
    start.y -= 0.18;
    const col = isMaelstrom ? 0x2ad6ff : this.weapon === 'ion_sniper' ? 0xb47aff : this.weapon === 'pulse_shotgun' ? 0xff9438 : 0x6ce8ff;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([start, end]),
      new THREE.LineBasicMaterial({ color: col })
    );
    this.scene.add(line);
    this.tracers.push({ line, ttl: 0.08 });
  }

  private damageCreature(c: CreatureEntity, rawDmg: number, stagger: boolean) {
    const dmg = rawDmg * (1 - c.armor);
    c.hp -= dmg;
    c.flashTimer = 0.12;
    c.alertTimer = 15;
    if (stagger) c.staggerTimer = 0.5;
    if (c.hp <= 0) {
      c.dead = true;
      c.mesh.visible = false;
      c.respawnTimer = c.kind === 'lanternback' || c.kind === 'dredgemaw' || c.kind === 'warden' ? 999999 : 1200;
      if (c.kind === 'skitterfin') {
        this.giveItem('raw_skitterfin', 1);
        this.toast('Skitterfin caught (+1 Raw Skitterfin).');
      } else if (c.kind === 'guardian_drone') {
        this.latticeAlert = Math.min(100, this.latticeAlert + 3);
        this.toast('Guardian Drone destroyed (+3 Lattice Alert).');
      } else if (c.kind === 'warden') {
        this.flags.wardenAlive = false;
        this.completeMission('3.05');
        this.toast('Warden Leviathan defeated! Path to the Heartspire is clear.');
      } else if (c.kind === 'dredgemaw' || c.kind === 'lanternback') {
        this.toast(`${c.kind.toUpperCase()} slain!`);
      }
    }
  }

  // ---- Main Simulation Tick ----

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.started && !this.paused && !this.ending) {
      if (this.intro) this.updateIntro(dt);
      else this.updateSimulation(dt);
    } else if (this.started && this.paused && !this.ending && this.craftingJob) {
      // Allow active fabricator jobs to progress smoothly while viewing the Fabricator PDA
      this.craftingJob.remaining -= dt;
      if (this.craftingJob.remaining <= 0) {
        const id = this.craftingJob.recipeId;
        this.craftingJob = null;
        this.finishCraft(id);
        this.emitSnapshot();
      } else {
        this.snapshotAccum += dt;
        if (this.snapshotAccum >= 0.08) {
          this.snapshotAccum = 0;
          this.emitSnapshot();
        }
      }
    }
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(dt: number) {
    // Timers
    this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const stats = WEAPONS[this.weapon];
        if (!this.creative) this.consumeItems({ [stats.ammoType]: 1 });
        const maxMag = this.weapon === 'plasma_rifle' && this.hasExtMag ? 40 : stats.magSize;
        this.magAmmo[this.weapon] = maxMag;
      }
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastText = null;
    }
    if (this.recentUnlockTimer > 0) {
      this.recentUnlockTimer -= dt;
      if (this.recentUnlockTimer <= 0) this.recentUnlock = null;
    }
    this.viewKick = Math.max(0, this.viewKick - dt * 0.9);
    if (this.viewModelGroup) {
      this.viewModelGroup.position.z = -0.48 + this.viewKick;
    }

    // 40-min Day/Night Cycle + Weather
    this.cycleMinutes = (this.cycleMinutes + dt / 60) % 40;
    const isNight = this.cycleMinutes >= 26;
    const cellInfo = getCellCoords(this.px, this.pz);
    this.discoveredCells.add(cellInfo.code);
    if (cellInfo.biome === 'jungle_coast' && this.cycleMinutes < 4) this.weather = 'Spore Haze';
    else if (cellInfo.biome === 'jungle_coast' && Math.floor(this.cycleMinutes) % 12 === 0) this.weather = 'Rain';
    else if (cellInfo.biome === 'ashfall_highlands' && isNight) this.weather = 'Ash Storm';
    else this.weather = 'Calm';

    // Escape Timer (Ending B aftermath if active)
    if (this.escapeTimer > 0) {
      this.escapeTimer -= dt;
      if (this.escapeTimer <= 0) {
        this.continueFreeRoam();
      }
    }

    // Movement & Physics (Subnautica-inspired 3D swim & dive + walkable habitat interiors)
    const piloted = this.getPiloted();
    const onGroundH = terrainHeightAt(this.px, this.pz);
    const inSubmersible = piloted?.type === 'stingray' || piloted?.type === 'bulwark';
    const insideHab = !piloted ? this.getHabitatAt(this.px, this.py, this.pz) : null;
    const isSwimming = !insideHab && (this.py < -0.15 || (onGroundH < -0.5 && this.py <= 2.2));
    const inWater = this.py < -0.35;
    this.inWaterState = !insideHab && (isSwimming || inWater);
    const inHab = !!insideHab;
    this.inHabitatName = insideHab ? (insideHab.piece.type === 'large_hab' ? 'Large Habitat' : 'Small Habitat') : null;
    const inHeartspire = Math.hypot(this.px - LANDMARKS.heartspire.x, this.pz - LANDMARKS.heartspire.z) < 60 && this.flags.heartspireUnlocked;

    const fwdIn = this.joyY + (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafeIn = this.joyX + (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const diveHeld = this.keys.has('KeyC') || this.keys.has('ControlLeft');
    const ascendHeld = this.keys.has('Space');
    const vertIn = this.touchVert + (ascendHeld ? 1 : 0) - ((isSwimming || inSubmersible) && diveHeld ? 1 : 0);

    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    const fwd = _v1.set(0, 0, -1).applyEuler(_euler);
    const right = _v2.set(1, 0, 0).applyEuler(_euler);
    if ((!isSwimming && !inSubmersible) || piloted?.type === 'hover_skiff' || piloted?.type === 'prawn') {
      fwd.y = 0;
      fwd.normalize();
      right.y = 0;
      right.normalize();
    }

    const wish = _v3.set(0, 0, 0).addScaledVector(fwd, fwdIn).addScaledVector(right, strafeIn);
    if (isSwimming || inSubmersible) {
      wish.y += vertIn;
      // Prevent swimming up into open air above water surface unless actively pressing Ascend
      if (this.py > 0.15 && wish.y > 0 && vertIn <= 0) {
        wish.y = 0;
      }
      if (this.crouching) this.crouching = false;
    }
    if (wish.lengthSq() > 1) wish.normalize();

    let speed = 5.5;
    const sprinting = (this.keys.has('ShiftLeft') || this.touchSprint) && !this.crouching && wish.lengthSq() > 0.05;
    this.isSprinting = sprinting;

    if (piloted) {
      if (piloted.boostCd > 0) piloted.boostCd = Math.max(0, piloted.boostCd - dt);
      if (piloted.boostActive > 0) piloted.boostActive = Math.max(0, piloted.boostActive - dt);
      if (piloted.maelstromReload > 0) piloted.maelstromReload = Math.max(0, piloted.maelstromReload - dt);

      if ((this.keys.has('ShiftLeft') || this.touchSprint) && piloted.boostCd <= 0 && (this.creative || piloted.power >= 6)) {
        const hasUpgradedBoost = piloted.type === 'hover_skiff' && piloted.upgrades.skiffBoost;
        if (piloted.type !== 'prawn') {
          if (!this.creative) piloted.power = Math.max(0, piloted.power - 6);
          piloted.boostActive = hasUpgradedBoost ? 4.5 : 3.2;
          piloted.boostCd = hasUpgradedBoost ? 12 : 14;
          sound.playScan();
          this.toast(`${piloted.name} Boost engaged!`);
        }
      }

      const boostBonus =
        piloted.boostActive > 0
          ? piloted.type === 'stingray'
            ? 4
            : piloted.type === 'hover_skiff' && piloted.upgrades.skiffBoost
            ? 5
            : 3.5
          : 0;
      speed = piloted.speed + boostBonus;
      if (piloted.power <= 0 && !this.creative) speed *= 0.25;
      else if (wish.lengthSq() > 0.01 && !this.creative) {
        const drain = piloted.type === 'bulwark' ? 1.2 : piloted.type === 'stingray' ? 0.5 : piloted.type === 'hover_skiff' ? 0.4 : 0.3;
        piloted.power = Math.max(0, piloted.power - drain * dt);
      }
    } else {
      if (isSwimming) speed = sprinting ? 8.2 : 5.6;
      else speed = sprinting ? 9.2 : this.crouching ? 3.5 : 5.8;
      if (this.suitTier === 'reinforced') speed *= 0.92;
      if (this.weather === 'Ash Storm') speed *= 0.85;
    }

    wish.multiplyScalar(speed);
    const lerpAlpha = Math.min(1, 7.5 * dt);
    if (isSwimming || inSubmersible) {
      this.vel.lerp(wish, lerpAlpha);
    } else {
      this.vel.x = THREE.MathUtils.lerp(this.vel.x, wish.x, lerpAlpha);
      this.vel.z = THREE.MathUtils.lerp(this.vel.z, wish.z, lerpAlpha);
    }
    this.px = THREE.MathUtils.clamp(this.px + this.vel.x * dt, -HALF_WORLD + 20, HALF_WORLD - 20);
    this.pz = THREE.MathUtils.clamp(this.pz + this.vel.z * dt, -HALF_WORLD + 20, HALF_WORLD - 20);

    const floorY = terrainHeightAt(this.px, this.pz);
    if (piloted?.type === 'hover_skiff') {
      if (floorY < -1.8) {
        this.py = THREE.MathUtils.damp(this.py, 0.4, 5, dt);
        this.vel.multiplyScalar(0.9);
      } else {
        this.py = THREE.MathUtils.damp(this.py, Math.max(0.8, floorY + 0.9), 8, dt);
      }
    } else if (piloted?.type === 'stingray' || piloted?.type === 'bulwark') {
      this.py += this.vel.y * dt;
      if (this.py > -0.6) this.py = -0.6;
      if (this.py < floorY + 2.2) this.py = floorY + 2.2;
    } else if (piloted?.type === 'prawn') {
      if ((this.keys.has('Space') || this.touchVert > 0) && this.py <= floorY + 3.6) {
        this.vel.y = piloted.upgrades.thrusterMod ? 13.5 : 9.2;
      }
      this.vel.y -= 14 * dt;
      this.py += this.vel.y * dt;
      if (this.py < floorY + 3.2) {
        this.py = floorY + 3.2;
        this.vel.y = Math.max(0, this.vel.y);
      }
    } else {
      // On foot / swimming / inside physical Lifepod 07
      const lpDx = this.px - LANDMARKS.lifepod07.x;
      const lpDz = this.pz - LANDMARKS.lifepod07.z;
      const lpDist = Math.hypot(lpDx, lpDz);
      const inDoorGap = lpDz > 0.75 && Math.abs(lpDx) < 0.75;

      if (this.inLifepod) {
        if (lpDz > 2.6 && Math.abs(lpDx) < 0.85) {
          // Walked right out the open airlock doorway onto boarding deck / water
          this.inLifepod = false;
          sound.playHatch();
        } else {
          // Constrain gently to circular cabin interior unless walking out the open doorway
          if (lpDist > 1.85 && !inDoorGap) {
            const k = 1.85 / lpDist;
            this.px = LANDMARKS.lifepod07.x + lpDx * k;
            this.pz = LANDMARKS.lifepod07.z + lpDz * k;
          }
          if (ascendHeld && this.py <= this.lifepodY + 2.05) {
            this.vel.y = 4.5;
          }
          this.vel.y -= 18 * dt;
          this.py += this.vel.y * dt;
          const cabinFloorY = this.lifepodY + (this.crouching ? 1.45 : 1.95);
          const cabinCeilY = this.lifepodY + 2.85;
          if (this.py < cabinFloorY) {
            this.py = cabinFloorY;
            this.vel.y = Math.max(0, this.vel.y);
          } else if (this.py > cabinCeilY) {
            this.py = cabinCeilY;
            this.vel.y = Math.min(0, this.vel.y);
          }
        }
      } else {
        // Outside Lifepod: check if walking in through the open +Z doorway
        if (lpDist < 2.25 && lpDz > 0.45 && Math.abs(lpDx) < 0.75 && this.py >= this.lifepodY - 0.2 && this.py <= this.lifepodY + 3.2) {
          this.inLifepod = true;
          this.py = this.lifepodY + 1.95;
          this.vel.y = 0;
          sound.playHatch();
        } else {
          // Solid exterior hull collision so you walk/swim around the pod rather than clipping through it
          if (lpDist < 2.88 && !inDoorGap && this.py > this.lifepodY - 1.2 && this.py < this.lifepodY + 3.6) {
            const k = 2.88 / Math.max(0.01, lpDist);
            this.px = LANDMARKS.lifepod07.x + lpDx * k;
            this.pz = LANDMARKS.lifepod07.z + lpDz * k;
          }

          // Check built Small / Large Habitat walkable interiors & outer wall collision
          let handledByHab = false;
          for (const b of this.bases) {
            if (b.type !== 'small_hab' && b.type !== 'large_hab') continue;
            const isLarge = b.type === 'large_hab';
            const innerR = isLarge ? 4.65 : 2.72;
            const outerR = isLarge ? 5.45 : 3.45;
            const deckOffset = isLarge ? 0.58 : 0.48;
            const ceilH = isLarge ? 4.1 : 3.05;
            const doorZ = isLarge ? 3.2 : 1.9;
            const doorHalfW = isLarge ? 1.28 : 1.0;

            const dx = this.px - b.x;
            const dz = this.pz - b.z;
            const dist = Math.hypot(dx, dz);
            if (dist > outerR + 0.6 || this.py < b.y - 0.5 || this.py > b.y + ceilH + 0.35) continue;

            const cos = Math.cos(b.yaw);
            const sin = Math.sin(b.yaw);
            const lx = dx * cos - dz * sin;
            const lz = dx * sin + dz * cos;
            const inDoorGap = lz > doorZ && Math.abs(lx) < doorHalfW;

            if (dist <= innerR) {
              handledByHab = true;
              if (ascendHeld && this.py <= b.y + deckOffset + 2.05) {
                this.vel.y = 5.5;
              }
              this.vel.y -= 18 * dt;
              this.py += this.vel.y * dt;
              const habFloorY = b.y + deckOffset + (this.crouching ? 1.2 : 1.75);
              const habCeilY = b.y + ceilH - 0.25;
              if (this.py < habFloorY) {
                this.py = habFloorY;
                this.vel.y = Math.max(0, this.vel.y);
              } else if (this.py > habCeilY) {
                this.py = habCeilY;
                this.vel.y = Math.min(0, this.vel.y);
              }
              break;
            } else if (!inDoorGap && dist < outerR) {
              const k = outerR / Math.max(0.01, dist);
              this.px = b.x + dx * k;
              this.pz = b.z + dz * k;
            } else if (inDoorGap && dist <= outerR) {
              handledByHab = true;
              const stepFloor = b.y + deckOffset + (this.crouching ? 1.2 : 1.75);
              if (this.py < stepFloor) {
                this.py = THREE.MathUtils.damp(this.py, stepFloor, 10, dt);
                this.vel.y = Math.max(0, this.vel.y);
              }
              break;
            }
          }

          if (!handledByHab) {
            if (isSwimming || floorY < -0.6) {
              this.py += this.vel.y * dt;
              if (this.py > 0.9) {
                this.py = 0.9;
                if (this.vel.y > 0) this.vel.y = 0;
              }
              const minSwimY = floorY + 1.35;
              if (this.py < minSwimY) {
                this.py = minSwimY;
                if (this.vel.y < 0) this.vel.y = 0;
              }
            } else {
              if (ascendHeld && this.py <= floorY + 2.1) {
                this.vel.y = 8.5;
              }
              this.vel.y -= 20 * dt;
              this.py += this.vel.y * dt;
              const standH = this.crouching ? 1.2 : 1.8;
              if (this.py < floorY + standH) {
                this.py = floorY + standH;
                this.vel.y = Math.max(0, this.vel.y);
              }
            }
          }
        }
      }
    }

    this.vehicleSpeed = piloted ? this.vel.length() : 0;

    if (piloted) {
      piloted.x = this.px;
      piloted.y = this.py;
      piloted.z = this.pz;
      piloted.yaw = this.yaw;
      const vm = this.vehicleMeshes.get(piloted.id);
      if (vm) {
        vm.position.set(piloted.x, piloted.y, piloted.z);
        vm.rotation.y = piloted.yaw;
      }
    }

    // Spin vehicle rotors/drills smoothly across visible fleet & subtle 1st-person cockpit vibration
    const rotorSpinBase = piloted ? 4 + this.vehicleSpeed * 2.5 : 1.6;
    for (const [id, vm] of this.vehicleMeshes.entries()) {
      if (!vm.visible) continue;
      const spin = id === this.pilotingId ? rotorSpinBase : 1.5;
      vm.traverse((o) => {
        if (o.name === 'rotor') o.rotation.z += dt * spin;
      });
    }
    if (this.cockpitGroup && piloted) {
      const sway = Math.sin(performance.now() * 0.004) * 0.004 * Math.min(1, this.vehicleSpeed * 0.15 + 0.15);
      this.cockpitGroup.position.set(-strafeIn * 0.014, sway, Math.min(0.02, this.vehicleSpeed * 0.002));
      this.cockpitGroup.rotation.z = -strafeIn * 0.02;
    }

    // Smooth camera FOV boost & subtle swim/strafe roll tilt
    const targetFov = sprinting || (piloted?.boostActive ?? 0) > 0 ? 77 : 72;
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.04) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
    const targetRoll = (isSwimming || inSubmersible) ? -THREE.MathUtils.clamp(strafeIn, -1, 1) * 0.032 : 0;
    this.camRoll = THREE.MathUtils.damp(this.camRoll, targetRoll, 7, dt);

    this.camera.position.set(this.px, this.py + (piloted ? 0.6 : 0), this.pz);
    this.camera.rotation.set(this.pitch, this.yaw, this.camRoll, 'YXZ');

    // Noise (Acoustic Signature)
    let baseNoise = 0;
    if (piloted) {
      baseNoise = piloted.type === 'bulwark' ? (piloted.lightsOn ? 40 : 6) : piloted.type === 'prawn' ? 45 : piloted.type === 'stingray' ? 25 : 22;
    } else if (this.vel.length() > 1.2) {
      if (isSwimming) baseNoise = sprinting ? 14 : 6;
      else baseNoise = sprinting ? 20 : this.crouching ? 4 : 8;
    }
    this.noiseRadius = Math.max(baseNoise, this.noiseRadius - 35 * dt);

    // Firing & Scanning
    if (this.firing) this.fireActiveWeapon();
    if (this.scanning || (this.firing && this.tool === 'scanner')) {
      this.performScan(dt);
    } else {
      this.scanTargetName = null;
    }

    // Survival Vitals, Oxygen & Pressure
    const depth = Math.max(0, -this.py);
    const safeDepth = piloted ? piloted.crushDepth : this.suitTier === 'reinforced' ? 250 : 90;

    if (!this.creative) {
      this.nutrition = Math.max(0, this.nutrition - dt / 36);
      this.hydration = Math.max(0, this.hydration - dt / 27);
      if (this.nutrition <= 0) this.hp -= dt / 5;
      if (this.hydration <= 0) this.hp -= dt / 4;

      if (!inWater || this.inLifepod || inHab || inHeartspire || (piloted && piloted.type !== 'hover_skiff')) {
        this.o2 = Math.min(this.o2Max, this.o2 + 30 * dt);
      } else {
        const drain = this.suitIntegrity <= 0 ? 2 : 1;
        this.o2 = Math.max(0, this.o2 - drain * dt);
        if (this.o2 <= 0) this.hurtPlayer(8 * dt);
      }

      if (depth > safeDepth && !inHeartspire) {
        const over10m = (depth - safeDepth) / 10;
        this.hurtPlayer(5 * over10m * dt);
      }
      if (depth > safeDepth - 20 && depth > 10 && !inHeartspire) {
        this.klaxonTimer -= dt;
        if (this.klaxonTimer <= 0) {
          sound.playKlaxon();
          this.klaxonTimer = 2.4;
        }
      }

      // Environmental Hazards
      if (Math.hypot(this.px - LANDMARKS.emberTerraces.x, this.pz - LANDMARKS.emberTerraces.z) < 70 && Math.abs(this.py - floorY) < 10) {
        this.hurtPlayer((this.suitTier === 'reinforced' ? 5 : 10) * dt);
      }
      if (Math.hypot(this.px - LANDMARKS.repulsAft.x, this.pz - LANDMARKS.repulsAft.z) < 35 && !this.flags.coolantFixed) {
        if (this.suitTier !== 'reinforced') {
          this.radiation = Math.min(100, this.radiation + 12 * dt);
          if (this.radiation >= 100) this.hurtPlayer(6 * dt);
        }
      } else {
        this.radiation = Math.max(0, this.radiation - 8 * dt);
      }

      if (this.hp <= 0) {
        this.handleDeath();
      }
    } else {
      this.hp = this.maxHp;
      this.nutrition = 100;
      this.hydration = 100;
      this.o2 = this.o2Max;
    }

    // Cache Beacon timer
    if (this.cacheLoot) {
      this.cacheTimer -= dt;
      if (this.cacheTimer <= 0) {
        this.cacheLoot = null;
        this.cacheBeaconMesh.visible = false;
      }
    }

    // Crafting Queue
    if (this.craftingJob) {
      this.craftingJob.remaining -= dt;
      if (this.craftingJob.remaining <= 0) {
        const id = this.craftingJob.recipeId;
        this.craftingJob = null;
        this.finishCraft(id);
      }
    }

    // Base Power, Hydroponics & Tern
    this.updateBaseAndTern(dt, isNight);
    this.updateResourceRegrowth(dt);
    this.updateCreaturesAndBoss(dt, isNight);
    this.updateAtmosphere(depth, isNight);
    this.updateBuildingGhost();
    this.updateHotspotPrompt();

    // Tracer FX cleanup
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].ttl -= dt;
      if (this.tracers[i].ttl <= 0) {
        this.scene.remove(this.tracers[i].line);
        this.tracers[i].line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Periodic Snapshot & Autosave
    this.snapshotAccum += dt;
    if (this.snapshotAccum >= 0.1) {
      this.snapshotAccum = 0;
      this.emitSnapshot();
    }
    this.autoSaveAccum += dt;
    if (this.autoSaveAccum >= 15) {
      this.autoSaveAccum = 0;
      this.saveGame();
    }
  }

  private performScan(dt: number) {
    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    const dir = _v1.set(0, 0, -1).applyEuler(_euler);
    let targetId: string | null = null;
    let targetName = '';

    for (const c of this.creatures) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - this.px, c.y - this.py, c.z - this.pz);
      if (d > 22) continue;
      _v2.set(c.x - this.px, c.y - this.py, c.z - this.pz).normalize();
      if (_v2.dot(dir) > 0.85) {
        targetId = c.kind;
        targetName = c.kind;
        break;
      }
    }

    if (!targetId) {
      for (const n of this.nodes) {
        if (n.regrowTimer > 0) continue;
        const d = Math.hypot(n.x - this.px, n.y - this.py, n.z - this.pz);
        if (d > 14) continue;
        _v2.set(n.x - this.px, n.y - this.py, n.z - this.pz).normalize();
        if (_v2.dot(dir) > 0.85) {
          if (n.item === 'po_ore') targetId = 'plasteel_ore_scan';
          else if (n.item === 'hydro_crystal') targetId = 'hydro_crystal_scan';
          targetName = ITEMS[n.item].name;
          break;
        }
      }
    }

    if (!targetId) {
      this.scanProgress = 0;
      this.scanTargetName = null;
      return;
    }

    const dbEntry = DATABANK.find((d) => d.id === targetId);
    const displayName = dbEntry?.name ?? targetName ?? targetId;
    this.scanTargetName = displayName;
    this.scanProgress = Math.min(1, this.scanProgress + dt * 0.75);
    if (this.scanProgress >= 1) {
      this.scanProgress = 0;
      this.scanTargetName = null;
      this.scanning = false;
      this.scanCounts[targetId] = (this.scanCounts[targetId] ?? 0) + 1;
      if (targetId === 'plasteel_ore_scan') this.unlockedIds.add('u_plasteel');
      if (targetId === 'hydro_crystal_scan') {
        this.unlockedIds.add('u_hydro');
        this.unlockedIds.add('u_bloomfruit');
        this.completeMission('1.07', '1.08');
      }
      sound.playScan();
      this.recentUnlock = {
        title: 'DATABANK ENTRY UNLOCKED',
        subtitle: displayName,
      };
      this.recentUnlockTimer = 4.5;
      this.toast(`Scanned ${displayName}! Added to Databank.`);
    }
  }

  private handleDeath() {
    this.hp = 100;
    this.nutrition = 60;
    this.hydration = 60;
    this.o2 = this.o2Max;
    this.radiation = 0;

    // Drop gathered ores into Cache Beacon (60 min)
    const dropped: Partial<Record<ItemId, number>> = {};
    for (const k of ['ti_ore', 'si_dep', 'cu_ore', 'po_ore', 'hydro_crystal', 'sup_ore', 'salvage'] as ItemId[]) {
      if ((this.inventory[k] ?? 0) > 0) {
        dropped[k] = this.inventory[k];
        delete this.inventory[k];
      }
    }
    if (Object.keys(dropped).length > 0) {
      this.cacheLoot = dropped;
      this.cachePos.set(this.px, this.py, this.pz);
      this.cacheTimer = 3600;
      this.cacheBeaconMesh.position.copy(this.cachePos);
      this.cacheBeaconMesh.visible = true;
    }

    this.px = this.respawnPos.x;
    this.py = this.respawnPos.y;
    this.pz = this.respawnPos.z;
    this.inLifepod = Math.hypot(this.px - LANDMARKS.lifepod07.x, this.pz - LANDMARKS.lifepod07.z) < 2.4;
    this.vel.set(0, 0, 0);
    this.toast('You died. Respawned at last Bunk / Lifepod 07. Items dropped at Cache Beacon.');
  }

  private updateBaseAndTern(dt: number, isNight: boolean) {
    let solarCount = 0;
    let batteryCount = 0;
    for (const b of this.bases) {
      if (b.disabledTimer > 0) {
        b.disabledTimer = Math.max(0, b.disabledTimer - dt);
        continue;
      }
      if (b.type === 'solar_panel') solarCount++;
      if (b.type === 'battery_bank') batteryCount++;
      if (b.type === 'hydroponics' && b.cropReady === 0) {
        b.cropProgress += dt / 90;
        if (b.cropProgress >= 1) {
          b.cropProgress = 0;
          b.cropReady = 1;
        }
      }
    }

    this.baseSolarRate = isNight ? 0 : solarCount * 5;
    this.basePowerCap = 100 + batteryCount * 300;
    this.basePower = Math.min(this.basePowerCap, this.basePower + (this.baseSolarRate / 60) * dt);

    // Lattice Alert decay (-1/min) & Seeker Raid at 50
    if (this.latticeAlert > 0) {
      this.latticeAlert = Math.max(0, this.latticeAlert - (dt / 60));
    }
    if (this.latticeAlert >= 50 && this.raidActive <= 0 && this.bases.length > 0) {
      this.raidActive = 90;
      this.latticeAlert = 20;
      const b = this.bases[0];
      this.spawnEnemyBurst('seeker', b.x, b.y + 12, b.z, 3);
      this.toast('LATTICE ALERT RAID! 3 Seekers inbound on your base!');
    }
    if (this.raidActive > 0) this.raidActive = Math.max(0, this.raidActive - dt);

    // Tern Support timers
    for (let i = 0; i < 3; i++) {
      this.ternCooldowns[i] = Math.max(0, this.ternCooldowns[i] - dt);
    }
    if (this.aegisTimer > 0) {
      this.aegisTimer = Math.max(0, this.aegisTimer - dt);
      this.aegisBubble.visible = true;
      this.aegisBubble.position.set(this.px, this.py, this.pz);
    } else {
      this.aegisBubble.visible = false;
    }

    if (this.overwatchTimer > 0) {
      this.overwatchTimer = Math.max(0, this.overwatchTimer - dt);
      let nearest: CreatureEntity | null = null;
      let bd = 60;
      for (const c of this.creatures) {
        if (c.dead || !c.hostile) continue;
        const d = Math.hypot(c.x - this.px, c.y - this.py, c.z - this.pz);
        if (d < bd) {
          bd = d;
          nearest = c;
        }
      }
      if (nearest) {
        this.damageCreature(nearest, 40 * dt, false);
        if (Math.random() < 0.25) {
          const l = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(this.px, this.py + 16, this.pz), new THREE.Vector3(nearest.x, nearest.y, nearest.z)]),
            new THREE.LineBasicMaterial({ color: 0xff8a24 })
          );
          this.scene.add(l);
          this.tracers.push({ line: l, ttl: 0.06 });
        }
      }
    }
  }

  private updateResourceRegrowth(dt: number) {
    for (const n of this.nodes) {
      if (n.regrowTimer > 0) {
        n.regrowTimer -= dt;
        if (n.regrowTimer <= 0) {
          n.regrowTimer = 0;
          n.mesh.visible = true;
        }
      }
    }
  }

  private updateCreaturesAndBoss(dt: number, isNight: boolean) {
    // Sentinel Spires (fire 15 DPS beam if weapon drawn within 60m)
    for (const sp of this.sentinelSpires) {
      const { sx, sy, sz } = sp.userData as { sx: number; sy: number; sz: number };
      const d = Math.hypot(sx - this.px, sy - this.py, sz - this.pz);
      if (d < 60 && !this.holstered && this.tool === 'weapon' && !this.pilotingId) {
        this.hurtPlayer(15 * dt);
        if (Math.random() < 0.35) {
          const l = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx, sy + 6.8, sz), new THREE.Vector3(this.px, this.py, this.pz)]),
            new THREE.LineBasicMaterial({ color: 0xff3b3b })
          );
          this.scene.add(l);
          this.tracers.push({ line: l, ttl: 0.07 });
        }
      }
    }

    // Fauna & Lattice Constructs
    for (const c of this.creatures) {
      if (c.dead) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.dead = false;
          c.hp = c.maxHp;
          c.x = c.homeX;
          c.y = c.homeY;
          c.z = c.homeZ;
          c.mesh.visible = true;
        }
        continue;
      }

      if (c.flashTimer > 0) c.flashTimer -= dt;
      if (c.staggerTimer > 0) {
        c.staggerTimer -= dt;
        continue;
      }
      if (c.vulnerableTimer > 0) c.vulnerableTimer -= dt;
      if (c.attackCd > 0) c.attackCd -= dt;

      const dist = Math.hypot(c.x - this.px, c.y - this.py, c.z - this.pz);
      if (dist > 260) continue; // skip far AI for smooth framerate

      const hearRange = (c.kind === 'dredgemaw' ? 2 : 1) * c.hearingRange;
      const detected =
        !this.inLifepod &&
        c.hostile &&
        ((dist < this.noiseRadius && dist < hearRange) ||
          (c.kind !== 'dredgemaw' && dist < (isNight ? 28 : 18)));

      if (detected) c.alertTimer = 8;
      if (c.alertTimer > 0) c.alertTimer -= dt;

      const fleeing = c.kind === 'snapjaw' && c.hp < c.maxHp * 0.2;
      const chasing = !this.inLifepod && c.hostile && c.alertTimer > 0 && !fleeing;

      if (chasing) {
        c.target.set(this.px, this.py, this.pz);
      } else if (fleeing) {
        c.target.set(c.x + (c.x - this.px), c.y, c.z + (c.z - this.pz));
      } else if (c.mesh.position.distanceTo(c.target) < 4) {
        c.target.set(
          c.homeX + (Math.random() - 0.5) * 65,
          c.aquatic ? Math.min(-2, c.homeY + (Math.random() - 0.5) * 14) : terrainHeightAt(c.homeX, c.homeZ) + 0.5,
          c.homeZ + (Math.random() - 0.5) * 65
        );
      }

      _v1.set(c.target.x - c.x, c.target.y - c.y, c.target.z - c.z);
      const len = _v1.length();
      if (len > 0.1) _v1.divideScalar(len);
      const spd = c.speed * (chasing ? 1 : 0.45);
      c.x += _v1.x * spd * dt;
      c.z += _v1.z * spd * dt;
      const floor = terrainHeightAt(c.x, c.z);
      if (c.aquatic) {
        c.y = Math.min(-1.2, Math.max(floor + c.radius, c.y + _v1.y * spd * dt));
      } else {
        c.y = floor + 0.6;
      }

      c.mesh.position.set(c.x, c.y, c.z);
      c.mesh.lookAt(c.target.x, c.y, c.target.z);

      // Voltaic Eel discharge cycle
      if (c.kind === 'voltaic_eel' && chasing && dist < 12) {
        c.dischargeTimer -= dt;
        if (c.dischargeTimer <= 0) {
          c.dischargeTimer = 8;
          c.vulnerableTimer = 4;
          this.hurtPlayer(18);
          this.toast('Voltaic Discharge! Eel vulnerable for 4s!');
        }
      }

      if (chasing && dist < c.radius + 3.2 && c.attackCd <= 0) {
        this.hurtPlayer(c.damage);
        c.attackCd = c.kind === 'dredgemaw' ? 4 : c.kind === 'lanternback' ? 3 : 1.4;
      }
    }

    // Custodian Boss Simulation (Heartspire Core Chamber)
    if (this.flags.custodianPhase >= 1 && this.flags.custodianPhase <= 4) {
      const hsY = terrainHeightAt(LANDMARKS.heartspire.x, LANDMARKS.heartspire.z);
      this.heartspire.custodianGroup.rotation.y += dt * 0.6;

      if (this.flags.custodianPhase === 1) {
        this.custodianCycle = (this.custodianCycle + dt) % 20;
        const exposed = this.custodianCycle >= 14;
        this.flags.custodianExposed = exposed;
        for (const p of this.heartspire.custodianPetals) {
          p.rotation.x = THREE.MathUtils.damp(p.rotation.x, exposed ? 0.85 : 0, 5, dt);
        }
        this.custodianAttackCd -= dt;
        if (this.custodianAttackCd <= 0) {
          this.custodianAttackCd = 4;
          const d = Math.hypot(this.px - LANDMARKS.heartspire.x, this.pz - LANDMARKS.heartspire.z);
          if (d < 55) this.hurtPlayer(20);
        }
        this.seekerWaveCd -= dt;
        if (this.seekerWaveCd <= 0) {
          this.seekerWaveCd = 30;
          this.spawnEnemyBurst('seeker', LANDMARKS.heartspire.x, hsY + 12, LANDMARKS.heartspire.z, 3);
        }
      } else if (this.flags.custodianPhase === 2) {
        this.anchorDroneCd -= dt;
        if (this.anchorDroneCd <= 0) {
          this.anchorDroneCd = 25;
          this.spawnEnemyBurst('guardian_drone', LANDMARKS.heartspire.x, hsY + 8, LANDMARKS.heartspire.z, 1);
        }
      } else if (this.flags.custodianPhase === 3) {
        this.flags.echoSpeechTimer -= dt;
        const t = this.flags.echoSpeechTimer;
        if (t > 60) {
          this.flags.echoLine = 'Captain’s Echo: “Directive Nine ordered us to seize the Lattice core as a weapon.”';
        } else if (t > 30) {
          this.flags.echoLine = 'Captain’s Echo: “I did not come here to be a villain. I came to end a war. I found something older, and I woke it.”';
        } else if (t > 0) {
          this.flags.echoLine = 'Captain’s Echo: “Disable it or destroy it at the Core Terminal. I cannot choose—I am only a copy.”';
        } else {
          this.flags.custodianPhase = 4;
          this.flags.custodianHp = 1500;
          this.flags.custodianMaxHp = 1500;
          this.flags.custodianExposed = true;
          this.flags.echoLine = 'Core exposed! Interact with the Core Terminal to Disable (Quiet Tide) or shoot the Core to Destroy (Last Light).';
        }
        this.seekerWaveCd -= dt;
        if (this.seekerWaveCd <= 0) {
          this.seekerWaveCd = 20;
          this.spawnEnemyBurst('seeker', LANDMARKS.heartspire.x, hsY + 10, LANDMARKS.heartspire.z, 2);
        }
      }
    }
  }

  private updateAtmosphere(depth: number, isNight: boolean) {
    const piloted = this.getPiloted();
    const headlampOn = depth > 18 || isNight || (piloted ? piloted.lightsOn : false);
    this.headLamp.intensity = piloted && !piloted.lightsOn ? 0 : headlampOn ? 3.2 : 0;

    if (depth > 0.35) {
      const fd = Math.min(1, depth / 320);
      const isCavern = getBiomeAt(this.px, this.pz) === 'cavern_reef';
      _colorA.setHex(isCavern ? 0x16143a : 0x1f8fb3);
      _colorB.setHex(0x01040b);
      _colorA.lerp(_colorB, Math.sqrt(fd));
      (this.scene.background as THREE.Color).copy(_colorA);
      (this.scene.fog as THREE.FogExp2).color.copy(_colorA);
      (this.scene.fog as THREE.FogExp2).density = 0.011 + fd * 0.012;
      this.hemiLight.intensity = Math.max(0.25, 0.9 - fd * 0.6);
      this.sunLight.intensity = Math.max(0.1, 1.1 - fd * 0.95);
    } else {
      const fogCol = isNight ? 0x09131f : this.weather === 'Ash Storm' ? 0x453b36 : this.weather === 'Spore Haze' ? 0x3b5848 : 0x8cc8e4;
      (this.scene.background as THREE.Color).setHex(fogCol);
      (this.scene.fog as THREE.FogExp2).color.setHex(fogCol);
      (this.scene.fog as THREE.FogExp2).density = this.weather === 'Ash Storm' ? 0.018 : this.weather === 'Spore Haze' ? 0.012 : 0.0018;
      this.hemiLight.intensity = isNight ? 0.35 : 0.95;
      this.sunLight.intensity = isNight ? 0.25 : 1.35;
    }

    // Subtle water bob
    this.waterMesh.position.y = Math.sin(performance.now() * 0.0012) * 0.14;
  }

  private getHabitatAt(x: number, y: number, z: number): { piece: BasePieceState; lx: number; lz: number; dist: number } | null {
    for (const b of this.bases) {
      if (b.type !== 'small_hab' && b.type !== 'large_hab') continue;
      const isLarge = b.type === 'large_hab';
      const innerR = isLarge ? 4.72 : 2.8;
      const ceilH = isLarge ? 4.15 : 3.1;
      const dx = x - b.x;
      const dz = z - b.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= innerR && y >= b.y - 0.35 && y <= b.y + ceilH) {
        const cos = Math.cos(b.yaw);
        const sin = Math.sin(b.yaw);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        return { piece: b, lx, lz, dist };
      }
    }
    return null;
  }

  private updateBuildingGhost() {
    if (!this.buildingMode || !this.ghostMesh) {
      this.buildingValid = false;
      this.buildingSnapLabel = null;
      return;
    }

    const isInteriorPiece =
      this.buildingMode === 'std_fab' ||
      this.buildingMode === 'workbench' ||
      this.buildingMode === 'med_bay' ||
      this.buildingMode === 'water_fab' ||
      this.buildingMode === 'hydroponics' ||
      this.buildingMode === 'alien_fab' ||
      this.buildingMode === 'bunk' ||
      this.buildingMode === 'storage_locker' ||
      this.buildingMode === 'wall_locker' ||
      this.buildingMode === 'work_terminal' ||
      this.buildingMode === 'battery_bank';

    const dir = _v1.set(0, 0, -1).applyEuler(_euler.set(this.pitch, this.yaw, 0, 'YXZ'));
    const reach = isInteriorPiece ? 3.6 : 11;
    let gx = Math.round((this.px + dir.x * reach) / 0.5) * 0.5;
    let gz = Math.round((this.pz + dir.z * reach) / 0.5) * 0.5;
    let gy = terrainHeightAt(gx, gz);
    this.buildingSnapLabel = 'Terrain Surface';

    // Snap interior stations/lockers neatly onto habitat floors or Lifepod cabin deck
    if (isInteriorPiece) {
      const targetHab = this.getHabitatAt(gx, this.py, gz) ?? this.getHabitatAt(this.px, this.py, this.pz);
      if (targetHab) {
        const b = targetHab.piece;
        const maxR = (b.type === 'large_hab' ? 4.2 : 2.3) - 0.35;
        const hdx = gx - b.x;
        const hdz = gz - b.z;
        const hd = Math.hypot(hdx, hdz);
        if (hd > maxR) {
          gx = b.x + (hdx / hd) * maxR;
          gz = b.z + (hdz / hd) * maxR;
        }
        gy = b.y + (b.type === 'large_hab' ? 0.58 : 0.48);
        this.buildingSnapLabel = `Snapped to ${b.type === 'large_hab' ? 'Large Habitat' : 'Small Habitat'} Deck`;
      } else if (this.inLifepod) {
        gx = THREE.MathUtils.clamp(gx, LANDMARKS.lifepod07.x - 1.25, LANDMARKS.lifepod07.x + 1.25);
        gz = THREE.MathUtils.clamp(gz, LANDMARKS.lifepod07.z - 1.25, LANDMARKS.lifepod07.z + 1.25);
        gy = this.lifepodY + 0.42;
        this.buildingSnapLabel = 'Snapped to Lifepod 07 Cabin';
      } else {
        gx = Math.round((this.px + dir.x * 7.5) / 1) * 1;
        gz = Math.round((this.pz + dir.z * 7.5) / 1) * 1;
        gy = terrainHeightAt(gx, gz);
      }
    } else if (this.buildingMode === 'connector' || this.buildingMode === 'small_hab' || this.buildingMode === 'large_hab') {
      gx = Math.round((this.px + dir.x * 11) / 2) * 2;
      gz = Math.round((this.pz + dir.z * 11) / 2) * 2;
      gy = terrainHeightAt(gx, gz);
      // Snap cleanly adjacent to existing habitats/connectors
      let nearestHub: BasePieceState | null = null;
      let bestDist = 14;
      for (const b of this.bases) {
        if (b.type !== 'small_hab' && b.type !== 'large_hab' && b.type !== 'connector') continue;
        const d = Math.hypot(gx - b.x, gz - b.z);
        if (d < bestDist) {
          bestDist = d;
          nearestHub = b;
        }
      }
      if (nearestHub) {
        const snapR =
          this.buildingMode === 'connector'
            ? nearestHub.type === 'large_hab'
              ? 7.8
              : nearestHub.type === 'small_hab'
              ? 5.8
              : 5.0
            : nearestHub.type === 'large_hab'
            ? 10.5
            : 8.5;
        const ang = Math.round(Math.atan2(gz - nearestHub.z, gx - nearestHub.x) / (Math.PI / 4)) * (Math.PI / 4);
        gx = nearestHub.x + Math.cos(ang) * snapR;
        gz = nearestHub.z + Math.sin(ang) * snapR;
        gy = nearestHub.y;
        this.buildingSnapLabel = 'Snapped to Habitat Port';
      }
    } else {
      gx = Math.round((this.px + dir.x * 11) / 2) * 2;
      gz = Math.round((this.pz + dir.z * 11) / 2) * 2;
      gy = terrainHeightAt(gx, gz);
    }

    this.buildPos.set(gx, gy, gz);
    this.ghostMesh.position.copy(this.buildPos);
    this.ghostMesh.rotation.y = this.yaw + this.buildingYaw;

    const nearRepuls =
      Math.hypot(gx - LANDMARKS.repulsMid.x, gz - LANDMARKS.repulsMid.z) < 40 ||
      Math.hypot(gx - LANDMARKS.repulsBow.x, gz - LANDMARKS.repulsBow.z) < 40 ||
      Math.hypot(gx - LANDMARKS.repulsAft.x, gz - LANDMARKS.repulsAft.z) < 40;
    const ternNeedsLand = this.buildingMode === 'tern_pad' && gy < 0;
    this.buildingValid = !nearRepuls && !ternNeedsLand;
    this.ghostMat.color.setHex(this.buildingValid ? 0x2ad6ff : 0xff4d4d);
  }

  private updateHotspotPrompt() {
    const lookDir = _v1.set(0, 0, -1).applyEuler(_euler.set(this.pitch, this.yaw, 0, 'YXZ'));

    // Track deconstruct target when holding Habitat Builder (without active ghost)
    if (this.tool === 'builder' && !this.buildingMode && !this.pilotingId) {
      let bestPiece: BasePieceState | null = null;
      let bestScore = -Infinity;
      for (const b of this.bases) {
        const dx = b.x - this.px;
        const dy = b.y + 1 - this.py;
        const dz = b.z - this.pz;
        const d = Math.hypot(dx, dy, dz);
        if (d < 8.5) {
          const dot = d > 0.05 ? (dx * lookDir.x + dy * lookDir.y + dz * lookDir.z) / d : 1;
          if (dot > 0.45 || d < 3.2) {
            const sc = dot * 3 - d * 0.35;
            if (sc > bestScore) {
              bestScore = sc;
              bestPiece = b;
            }
          }
        }
      }
      this.deconstructTarget = bestPiece
        ? { id: bestPiece.id, name: ITEMS[bestPiece.type]?.name ?? bestPiece.type }
        : null;
    } else {
      this.deconstructTarget = null;
    }

    let best: Hotspot | null = null;
    let bestScore = -Infinity;
    for (const h of this.hotspots) {
      if (h.condition && !h.condition()) continue;
      const dx = h.x - this.px;
      const dy = h.y - this.py;
      const dz = h.z - this.pz;
      const d = Math.hypot(dx, dy, dz);
      if (d < h.radius) {
        const dot = d > 0.05 ? (dx * lookDir.x + dy * lookDir.y + dz * lookDir.z) / d : 1;
        // Prefer hotspots the player is looking at, balanced by proximity
        const score = dot * 3.0 - d * 0.45;
        if (score > bestScore) {
          bestScore = score;
          best = h;
        }
      }
    }
    this.nearestHotspot = best;
    if (best) {
      this.promptText = `[E] ${best.label}`;
      return;
    }

    for (const b of this.bases) {
      if (b.type === 'small_hab' || b.type === 'large_hab' || b.type === 'connector' || b.type === 'solar_panel' || b.type === 'battery_bank') continue;
      if (Math.hypot(b.x - this.px, b.y + 1 - this.py, b.z - this.pz) < 6.5) {
        this.promptText = `[E] Use ${ITEMS[b.type]?.name ?? b.type}`;
        return;
      }
    }

    for (const v of this.vehicles) {
      if (!this.pilotingId && Math.hypot(v.x - this.px, v.y - this.py, v.z - this.pz) < 10) {
        this.promptText = `[E] Board ${v.name}`;
        return;
      }
    }

    for (const n of this.nodes) {
      if (n.regrowTimer <= 0 && Math.hypot(n.x - this.px, n.y - this.py, n.z - this.pz) < 9) {
        this.promptText = `[E] Gather ${ITEMS[n.item].name}${n.hardened ? ' (Hardened - PRAWN Drill)' : ''}`;
        return;
      }
    }
    this.promptText = null;
  }

  public emitSnapshot() {
    const cellInfo = getCellCoords(this.px, this.pz);
    const piloted = this.getPiloted();
    const depth = Math.max(0, -this.py);
    const elevation = Math.max(0, this.py);
    const safeDepth = piloted ? piloted.crushDepth : this.suitTier === 'reinforced' ? 250 : 90;
    const insideHab = !piloted ? this.getHabitatAt(this.px, this.py, this.pz) : null;
    const inHab = !!insideHab;
    const inHabitatName = insideHab ? (insideHab.piece.type === 'large_hab' ? 'Large Habitat' : 'Small Habitat') : null;
    const inHeartspire = Math.hypot(this.px - LANDMARKS.heartspire.x, this.pz - LANDMARKS.heartspire.z) < 60 && this.flags.heartspireUnlocked;

    let inHazard: string | null = null;
    if (depth > safeDepth && !inHeartspire) inHazard = 'CRUSH DEPTH EXCEEDED';
    else if (this.radiation > 25) inHazard = `RADIATION ${Math.round(this.radiation)}%`;
    else if (Math.hypot(this.px - LANDMARKS.emberTerraces.x, this.pz - LANDMARKS.emberTerraces.z) < 70 && Math.abs(this.py - terrainHeightAt(this.px, this.pz)) < 10) inHazard = 'THERMAL SCALD';

    const hr = Math.floor((this.cycleMinutes / 40) * 24);
    const mn = Math.floor(((this.cycleMinutes / 40) * 24 * 60) % 60);
    const dayTimeLabel = `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;

    const minimapEntities: GameSnapshot['minimapEntities'] = [];
    for (const b of this.bases) minimapEntities.push({ x: b.x, z: b.z, kind: 'base' });
    for (const v of this.vehicles) minimapEntities.push({ x: v.x, z: v.z, kind: 'vehicle' });
    for (const c of this.creatures) {
      if (!c.dead && c.hostile && Math.hypot(c.x - this.px, c.z - this.pz) < 260) {
        minimapEntities.push({
          x: c.x,
          z: c.z,
          kind: c.kind === 'lanternback' || c.kind === 'dredgemaw' || c.kind === 'warden' ? 'leviathan' : 'enemy',
        });
      }
    }
    minimapEntities.push({ x: LANDMARKS.repulsMid.x, z: LANDMARKS.repulsMid.z, kind: 'wreck' });
    minimapEntities.push({ x: LANDMARKS.repulsBow.x, z: LANDMARKS.repulsBow.z, kind: 'wreck' });
    minimapEntities.push({ x: LANDMARKS.repulsAft.x, z: LANDMARKS.repulsAft.z, kind: 'wreck' });
    minimapEntities.push({ x: LANDMARKS.waystationAlpha.x, z: LANDMARKS.waystationAlpha.z, kind: 'orrin' });
    minimapEntities.push({ x: LANDMARKS.heartspire.x, z: LANDMARKS.heartspire.z, kind: 'orrin' });
    if (this.cacheLoot) minimapEntities.push({ x: this.cachePos.x, z: this.cachePos.z, kind: 'cache' });

    const usedSlots = Object.entries(this.inventory).reduce((acc, [id, qty]) => {
      const lim = ITEMS[id as ItemId]?.stackLimit ?? 5;
      return acc + Math.ceil((qty ?? 0) / lim);
    }, 0);

    const lockerBonus = this.bases.reduce((acc, b) => acc + (b.type === 'storage_locker' ? 16 : b.type === 'wall_locker' ? 4 : 0), 0);

    this.onSnapshot({
      started: this.started,
      creative: this.creative,
      paused: this.paused,
      activeSaveSlot: this.activeSaveSlot,
      saveSlots: this.getSaveSlots(),
      intro: this.intro ? { ...this.intro } : null,
      ending: this.ending,
      freeRoamAfterEnd: this.freeRoamAfterEnd,
      escapeTimer: this.escapeTimer,
      hp: this.hp,
      maxHp: this.maxHp,
      nutrition: this.nutrition,
      hydration: this.hydration,
      o2: this.o2,
      o2Max: this.o2Max,
      suitIntegrity: this.suitIntegrity,
      maxSuitIntegrity: this.maxSuitIntegrity,
      radiation: this.radiation,
      depth,
      elevation,
      safeDepth,
      inHazard,
      inHabitat: inHab,
      inHabitatName,
      inLifepod: this.inLifepod,
      inHeartspire,
      inWater: this.inWaterState && !this.inLifepod,
      crouching: this.crouching,
      sprinting: this.isSprinting,
      holstered: this.holstered,
      pointerLocked: this.pointerLocked,
      x: this.px,
      y: this.py,
      z: this.pz,
      yaw: this.yaw,
      cell: cellInfo.code,
      biome: cellInfo.biome,
      biomeName: BIOME_NAMES[cellInfo.biome],
      weather: this.weather,
      isNight: this.cycleMinutes >= 26,
      dayTimeLabel,
      noiseRadius: this.noiseRadius,
      latticeAlert: this.latticeAlert,
      raidActive: this.raidActive,
      basePower: this.basePower,
      basePowerCap: this.basePowerCap,
      baseSolarRate: this.baseSolarRate,
      tool: this.tool,
      weapon: this.weapon,
      ownedWeapons: { ...this.ownedWeapons },
      magAmmo: { ...this.magAmmo },
      reserveAmmo: {
        plasma_cells: (this.inventory.plasma_cell_pack ?? 0) * 30,
        plasma_shells: (this.inventory.plasma_shell_pack ?? 0) * 12,
        energy_cells: this.inventory.energy_cell ?? 0,
      },
      reloadTimer: this.reloadTimer,
      hasSuppressor: this.hasSuppressor,
      hasExtMag: this.hasExtMag,
      suitTier: this.suitTier,
      tankTier: this.tankTier,
      ownedTools: { ...this.ownedTools },
      piloting: piloted ? { ...piloted } : null,
      vehicleSpeed: this.vehicleSpeed,
      vehicles: this.vehicles.map((v) => ({ ...v })),
      ternRestored: this.ternRestored,
      ternPadBuilt: this.ternPadBuilt,
      ternCharges: this.ternCharges,
      aegisTimer: this.aegisTimer,
      aegisShieldHp: this.aegisShieldHp,
      overwatchTimer: this.overwatchTimer,
      ternCooldowns: [...this.ternCooldowns] as [number, number, number],
      inventory: { ...this.inventory },
      usedSlots,
      maxSlots: (this.suitTier === 'reinforced' ? 22 : 18) + lockerBonus,
      unlockedIds: Array.from(this.unlockedIds),
      completedMissions: Array.from(this.completedMissions),
      activeMissionId: this.activeMissionId,
      discoveredLogs: Array.from(this.discoveredLogs),
      discoveredCells: Array.from(this.discoveredCells),
      scanCounts: { ...this.scanCounts },
      activeWaypoint: this.activeWaypoint,
      flags: { ...this.flags },
      buildingMode: this.buildingMode,
      buildingValid: this.buildingValid,
      buildingSnapLabel: this.buildingSnapLabel,
      buildingYawDeg: Math.round(((THREE.MathUtils.radToDeg(this.buildingYaw) % 360) + 360) % 360),
      deconstructTarget: this.deconstructTarget,
      craftingJob: this.craftingJob ? { ...this.craftingJob } : null,
      promptText: this.promptText,
      scanProgress: this.scanProgress,
      scanTargetName: this.scanTargetName,
      toastText: this.toastText,
      recentUnlock: this.recentUnlock,
      activeModal: this.activeModal,
      minimapEntities,
      bases: this.bases.map((b) => ({ ...b })),
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.cleanupListeners();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
