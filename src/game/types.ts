export type BiomeId =
  | 'shallow_reef'
  | 'jungle_coast'
  | 'cavern_reef'
  | 'deep_trench'
  | 'ashfall_highlands'
  | 'crash_coast';

export type StationType = 'standard' | 'workbench' | 'vehicle_bay' | 'builder' | 'alien';

export type ItemId =
  // 10 Base Resources
  | 'ti_ore'
  | 'si_dep'
  | 'cu_ore'
  | 'po_ore'
  | 'hydro_crystal'
  | 'energy_cell'
  | 'alien_biomass'
  | 'sup_ore'
  | 'bio_stabilizer'
  | 'salvage'
  // Fabricated Materials
  | 'ti_alloy'
  | 'plasteel'
  | 'cu_wire'
  | 'si_gel'
  | 'glass'
  | 'battery_core'
  | 'sup_filament'
  // Ammo
  | 'plasma_cell_pack'
  | 'plasma_shell_pack'
  // Tools & Consumables
  | 'repair_tool'
  | 'laser_cutter'
  | 'medkit'
  | 'hydro_gel'
  | 'ration_bar'
  | 'reef_fillet'
  | 'raw_skitterfin'
  | 'bloomfruit'
  | 'gourd'
  | 'hydro_cane'
  // Equipment & Upgrades
  | 'o2_mk2'
  | 'o2_mk3'
  | 'reinforced_suit'
  | 'depth_mk1'
  | 'depth_mk2'
  | 'speed_mod'
  | 'storage_mod'
  | 'power_cell_mk2'
  | 'skiff_boost'
  | 'suppressor'
  | 'ext_mag'
  // Alien Tech & Story Keys
  | 'resonance_plating'
  | 'pressure_lattice'
  | 'lattice_key'
  | 'flight_core'
  | 'black_box'
  | 'captains_keycard'
  | 'eng_pass'
  // Weapons
  | 'plasma_rifle'
  | 'pulse_shotgun'
  | 'ion_sniper'
  // Vehicles
  | 'stingray'
  | 'hover_skiff'
  | 'prawn'
  | 'prawn_drill'
  | 'prawn_grabber'
  | 'prawn_thruster'
  | 'prawn_cargo'
  | 'bulwark'
  | 'maelstrom'
  | 'tern_restore'
  // Base Structures & Furniture
  | 'small_hab'
  | 'large_hab'
  | 'hydroponics'
  | 'vehicle_bay'
  | 'med_bay'
  | 'water_fab'
  | 'alien_fab'
  | 'std_fab'
  | 'workbench'
  | 'battery_bank'
  | 'solar_panel'
  | 'connector'
  | 'tern_pad'
  | 'wall_locker'
  | 'storage_locker'
  | 'bunk'
  | 'work_terminal';

export interface ItemDef {
  id: ItemId;
  name: string;
  short: string;
  category: 'resource' | 'material' | 'ammo' | 'tool' | 'consumable' | 'equipment' | 'weapon' | 'vehicle' | 'base' | 'key';
  stackLimit: number;
  description: string;
}

export interface RecipeDef {
  id: string;
  output: ItemId;
  outputQty: number;
  name: string;
  category: string;
  station: StationType;
  ingredients: Partial<Record<ItemId, number>>;
  craftTime: number; // seconds
  powerCost: number; // PU
  unlockId: string;
  description: string;
  oneTime?: boolean;
  isAlien?: boolean;
}

export type ToolMode = 'weapon' | 'scanner' | 'repair' | 'cutter' | 'builder';
export type WeaponId = 'plasma_rifle' | 'pulse_shotgun' | 'ion_sniper';
export type VehicleType = 'stingray' | 'hover_skiff' | 'prawn' | 'bulwark';

export interface WeaponStats {
  id: WeaponId;
  name: string;
  damage: number;
  fireRate: number; // shots/s
  magSize: number;
  reloadTime: number;
  effectiveRange: number;
  maxRange: number;
  spreadDeg: number;
  noiseRadius: number;
  uwDamageMult: number;
  uwRangeMult: number;
  ammoType: 'plasma_cell_pack' | 'plasma_shell_pack' | 'energy_cell';
  shotsPerUnit: number;
  weakPointMult: number;
}

export interface VehicleState {
  id: string;
  type: VehicleType;
  name: string;
  hp: number;
  maxHp: number;
  power: number;
  maxPower: number;
  crushDepth: number;
  speed: number;
  strafeSpeed: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  lightsOn: boolean;
  cargo: Partial<Record<ItemId, number>>;
  cargoCap: number;
  upgrades: {
    depthMk: 0 | 1 | 2;
    pressureLattice: boolean;
    speedMod: boolean;
    storageMod: boolean;
    powerCellMk2: boolean;
    resonancePlating: boolean;
    skiffBoost: boolean;
    drillArm: boolean;
    grabberArm: boolean;
    thrusterMod: boolean;
    cargoRack: boolean;
    maelstrom: boolean;
  };
  maelstromAmmo: number;
  maelstromReload: number;
  boostCd: number;
  boostActive: number;
}

export interface BasePieceState {
  id: string;
  type:
    | 'small_hab'
    | 'large_hab'
    | 'connector'
    | 'solar_panel'
    | 'battery_bank'
    | 'hydroponics'
    | 'vehicle_bay'
    | 'med_bay'
    | 'water_fab'
    | 'alien_fab'
    | 'std_fab'
    | 'workbench'
    | 'tern_pad'
    | 'bunk'
    | 'storage_locker'
    | 'wall_locker'
    | 'work_terminal';
  x: number;
  y: number;
  z: number;
  yaw: number;
  disabledTimer: number;
  cropProgress: number; // for hydroponics
  cropReady: number;
  waterTimer: number;
}

export interface MissionDef {
  id: string;
  act: 1 | 2 | 3;
  title: string;
  location: string;
  cell: string;
  objective: string;
  rewardText: string;
  waypoint?: { x: number; y: number; z: number; label: string };
}

export interface LogDef {
  id: string;
  title: string;
  speaker: string;
  location: string;
  body: string;
  category: 'repuls' | 'pods' | 'orrin';
}

export interface DatabankEntry {
  id: string;
  name: string;
  category: 'fauna' | 'leviathan' | 'lattice' | 'flora' | 'tech';
  biome: string;
  summary: string;
  weakPoint?: string;
  scansNeeded: number;
}

export type ActiveModal =
  | null
  | { type: 'station'; station: StationType }
  | { type: 'inventory' }
  | { type: 'databank'; tab: 'missions' | 'logs' | 'map' | 'databank' }
  | { type: 'tern' }
  | { type: 'saves' }
  | { type: 'puzzle'; puzzleId: 'aux_power' | 'coolant_loop' | 'glyph_door' | 'core_terminal' };

export interface SaveSlotMeta {
  slotId: 1 | 2 | 3;
  empty: boolean;
  creative: boolean;
  savedAt: number;
  cell: string;
  biomeName: string;
  depth: number;
  activeMissionId: string;
  missionTitle: string;
  basesCount: number;
  vehiclesCount: number;
}

export interface IntroState {
  phase: 'evacuate' | 'ejection' | 'impact' | 'wake';
  timer: number;
  blackoutAlpha: number;
  headline: string;
  subtitle: string;
}

export interface CraftingJob {
  recipeId: string;
  name: string;
  output: ItemId;
  outputQty: number;
  station: StationType;
  remaining: number;
  total: number;
}

export interface GameSnapshot {
  started: boolean;
  creative: boolean;
  paused: boolean;
  activeSaveSlot: 1 | 2 | 3;
  saveSlots: SaveSlotMeta[];
  intro: IntroState | null;
  ending: null | 'quiet_tide' | 'last_light';
  freeRoamAfterEnd: boolean;
  escapeTimer: number; // >0 during Ending B 120s escape

  // Player vitals
  hp: number;
  maxHp: number;
  nutrition: number;
  hydration: number;
  o2: number;
  o2Max: number;
  suitIntegrity: number;
  maxSuitIntegrity: number;
  radiation: number;
  depth: number;
  elevation: number;
  safeDepth: number;
  inHazard: string | null;
  inHabitat: boolean;
  inHabitatName: string | null;
  inLifepod: boolean;
  inHeartspire: boolean;
  inWater: boolean;
  crouching: boolean;
  sprinting: boolean;
  holstered: boolean;
  pointerLocked: boolean;

  // World & time
  x: number;
  y: number;
  z: number;
  yaw: number;
  cell: string;
  biome: BiomeId;
  biomeName: string;
  weather: 'Calm' | 'Rain' | 'Spore Haze' | 'Ash Storm';
  isNight: boolean;
  dayTimeLabel: string;
  noiseRadius: number;
  latticeAlert: number;
  raidActive: number;

  // Base Power
  basePower: number;
  basePowerCap: number;
  baseSolarRate: number;

  // Equipment & Weapons
  tool: ToolMode;
  weapon: WeaponId;
  ownedWeapons: Record<WeaponId, boolean>;
  magAmmo: Record<WeaponId, number>;
  reserveAmmo: { plasma_cells: number; plasma_shells: number; energy_cells: number };
  reloadTimer: number;
  hasSuppressor: boolean;
  hasExtMag: boolean;
  suitTier: 'standard' | 'reinforced';
  tankTier: 1 | 2 | 3;
  ownedTools: { scanner: boolean; builder: boolean; repair: boolean; cutter: boolean };

  // Vehicle
  piloting: VehicleState | null;
  vehicleSpeed: number;
  vehicles: VehicleState[];

  // Tern Support
  ternRestored: boolean;
  ternPadBuilt: boolean;
  ternCharges: number;
  aegisTimer: number;
  aegisShieldHp: number;
  overwatchTimer: number;
  ternCooldowns: [number, number, number];

  // Inventory & Progression
  inventory: Partial<Record<ItemId, number>>;
  usedSlots: number;
  maxSlots: number;
  unlockedIds: string[];
  completedMissions: string[];
  activeMissionId: string;
  discoveredLogs: string[];
  discoveredCells: string[];
  scanCounts: Record<string, number>;
  activeWaypoint: { x: number; y: number; z: number; label: string } | null;

  // Story & Puzzles flags
  flags: {
    podFabRepaired: boolean;
    podWaterRepaired: boolean;
    auxPowerFixed: boolean;
    cargoCutOpen: boolean;
    bridgeBlackBoxTaken: boolean;
    armoryOpened: boolean;
    coolantFixed: boolean;
    reactorPowerOn: boolean;
    flightCoreTaken: boolean;
    glyphDoorOpened: boolean;
    blackBoxDecoded: boolean;
    authorityCodeObtained: boolean;
    heartspireUnlocked: boolean;
    nodeTideDone: boolean;
    nodeEchoDone: boolean;
    nodeWeightDone: boolean;
    custodianPhase: 0 | 1 | 2 | 3 | 4 | 5;
    custodianHp: number;
    custodianMaxHp: number;
    custodianExposed: boolean;
    echoSpeechTimer: number;
    echoLine: string;
    disableHoldTimer: number;
    wardenAlive: boolean;
  };

  // Building / Crafting / UI
  buildingMode: ItemId | null;
  buildingValid: boolean;
  buildingSnapLabel: string | null;
  buildingYawDeg: number;
  deconstructTarget: { id: string; name: string } | null;
  craftingJob: CraftingJob | null;
  promptText: string | null;
  scanProgress: number;
  scanTargetName: string | null;
  toastText: string | null;
  recentUnlock: { title: string; subtitle: string } | null;
  activeModal: ActiveModal;
  minimapEntities: Array<{ x: number; z: number; kind: 'base' | 'vehicle' | 'enemy' | 'leviathan' | 'wreck' | 'orrin' | 'cache' }>;
  bases: BasePieceState[];
}
