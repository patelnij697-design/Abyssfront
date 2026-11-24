import {
  BiomeId,
  DatabankEntry,
  ItemDef,
  ItemId,
  LogDef,
  MissionDef,
  RecipeDef,
  WeaponId,
  WeaponStats,
} from './types';

export const WORLD_SIZE = 3200;
export const HALF_WORLD = 1600;
export const CELL_SIZE = 400;

// 8x8 Grid from Section 3.2: Rows 1-8 (North to South), Cols A-H (West to East)
// J = jungle_coast, H = ashfall_highlands, C = crash_coast, S = shallow_reef, V = cavern_reef, T = deep_trench
const GRID_CHARS: string[][] = [
  ['J', 'J', 'J', 'H', 'H', 'H', 'H', 'H'], // Row 1
  ['J', 'J', 'J', 'J', 'H', 'H', 'H', 'H'], // Row 2
  ['J', 'J', 'J', 'C', 'C', 'H', 'H', 'H'], // Row 3
  ['J', 'J', 'J', 'J', 'J', 'C', 'C', 'H'], // Row 4
  ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'], // Row 5
  ['S', 'S', 'V', 'V', 'V', 'V', 'T', 'T'], // Row 6
  ['V', 'V', 'V', 'V', 'T', 'T', 'T', 'T'], // Row 7
  ['V', 'S', 'S', 'T', 'T', 'T', 'T', 'T'], // Row 8
];

const CHAR_TO_BIOME: Record<string, BiomeId> = {
  J: 'jungle_coast',
  H: 'ashfall_highlands',
  C: 'crash_coast',
  S: 'shallow_reef',
  V: 'cavern_reef',
  T: 'deep_trench',
};

export const BIOME_NAMES: Record<BiomeId, string> = {
  shallow_reef: 'Shallow Reef',
  jungle_coast: 'Jungle Coast',
  cavern_reef: 'Cavern Reef',
  deep_trench: 'Deep Trench',
  ashfall_highlands: 'Ashfall Highlands',
  crash_coast: 'Crash Coast',
};

export function getCellCoords(x: number, z: number): { col: number; row: number; code: string; biome: BiomeId } {
  const col = Math.max(0, Math.min(7, Math.floor((x + HALF_WORLD) / CELL_SIZE)));
  const row = Math.max(0, Math.min(7, Math.floor((z + HALF_WORLD) / CELL_SIZE)));
  const letter = String.fromCharCode(65 + col);
  const code = `${letter}${row + 1}`;
  const biome = CHAR_TO_BIOME[GRID_CHARS[row][col]];
  return { col, row, code, biome };
}

export function cellCenter(code: string): { x: number; z: number } {
  const col = code.charCodeAt(0) - 65;
  const row = parseInt(code.slice(1), 10) - 1;
  return {
    x: -HALF_WORLD + col * CELL_SIZE + CELL_SIZE / 2,
    z: -HALF_WORLD + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export const LANDMARKS = {
  lifepod07: { x: -600, z: 120, cell: 'C5', name: 'Lifepod 07 (Landfall Cove)' },
  smokeRidge: { x: 200, z: -1000, cell: 'E2', name: 'Smoke Ridge' },
  theThroat: { x: -1000, z: -200, cell: 'B4', name: 'The Throat (Sinkhole)' },
  throatGallery: { x: -1360, z: 1000, cell: 'A7', name: 'Throat Gallery' },
  rivermouth: { x: -600, z: -120, cell: 'C4', name: 'Veil Rivermouth' },
  repulsAft: { x: -40, z: -620, cell: 'D3', name: 'Repuls Aft (Engineering & Reactor)' },
  repulsMid: { x: 640, z: -240, cell: 'F4', name: 'Repuls Midship (Quarters, Cargo, Hangar)' },
  repulsBow: { x: 1040, z: 220, cell: 'G5', name: 'Repuls Bow (Bridge & Armory)' },
  kelpShelf: { x: -800, z: 1380, cell: 'B8', name: 'Kelp Shelf (Pod 05)' },
  pod03: { x: -1320, z: -980, cell: 'A2', name: 'Lifepod 03 Wreck' },
  pod05: { x: -780, z: 1380, cell: 'B8', name: 'Lifepod 05 Wreck' },
  pod09: { x: 240, z: 980, cell: 'E7', name: 'Lifepod 09 Wreck' },
  pod11: { x: 1050, z: -980, cell: 'G2', name: 'Lifepod 11 Wreck' },
  probeCasing: { x: 620, z: -1020, cell: 'F2', name: 'Crashed Probe Casing' },
  sentinelCorridor: { x: 1000, z: -600, cell: 'G3', name: 'Sentinel Corridor' },
  waystationAlpha: { x: -220, z: 1020, cell: 'D7', name: 'Waystation Alpha' },
  waystationBeta: { x: -980, z: 1020, cell: 'B7', name: 'Waystation Beta' },
  edgeOfEmbers: { x: 1380, z: -120, cell: 'H4', name: 'Edge of Embers' },
  emberTerraces: { x: 1120, z: 980, cell: 'G7', name: 'Ember Terraces' },
  heartspire: { x: 1400, z: 1400, cell: 'H8', name: 'The Heartspire' },
};

export const ITEMS: Record<ItemId, ItemDef> = {
  // 10 Base Resources
  ti_ore: { id: 'ti_ore', name: 'Titanium Ore', short: 'Ti Ore', category: 'resource', stackLimit: 10, description: 'Common light structural ore from Shallow Reef outcrops.' },
  si_dep: { id: 'si_dep', name: 'Silicate Deposit', short: 'Silicate', category: 'resource', stackLimit: 10, description: 'Crystalline silica used for Silicate Gel and Glass.' },
  cu_ore: { id: 'cu_ore', name: 'Copper Ore', short: 'Cu Ore', category: 'resource', stackLimit: 10, description: 'Conductive ore found near Jungle rivers and Highland canyons.' },
  po_ore: { id: 'po_ore', name: 'Plasteel Ore', short: 'Plasteel Ore', category: 'resource', stackLimit: 10, description: 'Dense dark mineral from Jungle canopy and Deep Trench walls.' },
  hydro_crystal: { id: 'hydro_crystal', name: 'Hydro Crystal', short: 'Hydro', category: 'resource', stackLimit: 10, description: 'Moisture-rich crystal clusters in damp Jungle hollows.' },
  energy_cell: { id: 'energy_cell', name: 'Energy Cell', short: 'E-Cell', category: 'resource', stackLimit: 10, description: 'High-density power cell. Fires the Ion Sniper and powers fabrication.' },
  alien_biomass: { id: 'alien_biomass', name: 'Alien Biomass', short: 'Biomass', category: 'resource', stackLimit: 10, description: 'Bioluminescent tissue harvested near Orrin architecture.' },
  sup_ore: { id: 'sup_ore', name: 'Superconductor Ore', short: 'Sup. Ore', category: 'resource', stackLimit: 10, description: 'Silver-violet Deep Trench mineral with near-zero resistance.' },
  bio_stabilizer: { id: 'bio_stabilizer', name: 'Bio-Plasma Stabilizer', short: 'Stabilizer', category: 'resource', stackLimit: 10, description: 'Amber-lit stabilizer formed in Ember Terrace thermal vents.' },
  salvage: { id: 'salvage', name: 'Salvage', short: 'Salvage', category: 'resource', stackLimit: 10, description: 'Recovered hull plating and components from the Repuls.' },

  // Fabricated Materials
  ti_alloy: { id: 'ti_alloy', name: 'Titanium Alloy', short: 'Ti Alloy', category: 'material', stackLimit: 5, description: 'Refined structural alloy.' },
  plasteel: { id: 'plasteel', name: 'Plasteel', short: 'Plasteel', category: 'material', stackLimit: 5, description: 'High-pressure hull composite.' },
  cu_wire: { id: 'cu_wire', name: 'Copper Wire', short: 'Cu Wire', category: 'material', stackLimit: 5, description: 'Drawn conductive wiring.' },
  si_gel: { id: 'si_gel', name: 'Silicate Gel', short: 'Si Gel', category: 'material', stackLimit: 5, description: 'Sealant and chemical stabilizer.' },
  glass: { id: 'glass', name: 'Glass', short: 'Glass', category: 'material', stackLimit: 5, description: 'Reinforced pressure glass.' },
  battery_core: { id: 'battery_core', name: 'Battery Core', short: 'Bat. Core', category: 'material', stackLimit: 5, description: 'Hydro-chemical core for Energy Cell assembly.' },
  sup_filament: { id: 'sup_filament', name: 'Superconductor Filament', short: 'Sup. Fil.', category: 'material', stackLimit: 5, description: 'Advanced Lattice-grade superconductor wiring.' },

  // Ammo
  plasma_cell_pack: { id: 'plasma_cell_pack', name: 'Plasma Cell Pack (30)', short: 'Cell Pack', category: 'ammo', stackLimit: 5, description: '30 rounds for the Plasma Assault Rifle.' },
  plasma_shell_pack: { id: 'plasma_shell_pack', name: 'Plasma Shell Pack (12)', short: 'Shell Pack', category: 'ammo', stackLimit: 5, description: '12 shells for the Pulse Shotgun.' },

  // Tools & Consumables
  repair_tool: { id: 'repair_tool', name: 'Repair Tool', short: 'Repair', category: 'tool', stackLimit: 1, description: 'Repairs damaged machinery, inert Repuls doors, vehicles, and suit.' },
  laser_cutter: { id: 'laser_cutter', name: 'Laser Cutter', short: 'Cutter', category: 'tool', stackLimit: 1, description: 'Cuts through sealed Repuls bulkheads and Armory vaults.' },
  medkit: { id: 'medkit', name: 'Medkit', short: 'Medkit', category: 'consumable', stackLimit: 5, description: 'Restores +50 Health.' },
  hydro_gel: { id: 'hydro_gel', name: 'Hydro Gel', short: 'Hydro Gel', category: 'consumable', stackLimit: 5, description: 'Restores +20 Hydration.' },
  ration_bar: { id: 'ration_bar', name: 'Ration Bar', short: 'Ration', category: 'consumable', stackLimit: 5, description: 'Restores +30 Nutrition.' },
  reef_fillet: { id: 'reef_fillet', name: 'Reef Fillet', short: 'Fillet', category: 'consumable', stackLimit: 5, description: 'Cooked Skitterfin. Restores +20 Nutrition.' },
  raw_skitterfin: { id: 'raw_skitterfin', name: 'Raw Skitterfin', short: 'Skitterfin', category: 'consumable', stackLimit: 5, description: 'Cook at a Fabricator into a Reef Fillet.' },
  bloomfruit: { id: 'bloomfruit', name: 'Bloomfruit', short: 'Bloomfruit', category: 'consumable', stackLimit: 5, description: '+15 Nutrition, +5 Hydration. Used in Medkits.' },
  gourd: { id: 'gourd', name: 'Hydroponic Gourd', short: 'Gourd', category: 'consumable', stackLimit: 5, description: '+25 Nutrition.' },
  hydro_cane: { id: 'hydro_cane', name: 'Hydro Cane', short: 'Hydro Cane', category: 'consumable', stackLimit: 5, description: '+10 Hydration.' },

  // Equipment & Upgrades
  o2_mk2: { id: 'o2_mk2', name: 'Oxygen Tank Mk2', short: 'O2 Mk2', category: 'equipment', stackLimit: 1, description: 'Expands base oxygen capacity to 120s.' },
  o2_mk3: { id: 'o2_mk3', name: 'Oxygen Tank Mk3', short: 'O2 Mk3', category: 'equipment', stackLimit: 1, description: 'Expands base oxygen capacity to 180s.' },
  reinforced_suit: { id: 'reinforced_suit', name: 'Reinforced Suit', short: 'Reinf. Suit', category: 'equipment', stackLimit: 1, description: '250m depth rating, +20s O2, 25% damage reduction, caustic & radiation protection, 22 slots.' },
  depth_mk1: { id: 'depth_mk1', name: 'Depth Module Mk1', short: 'Depth Mk1', category: 'equipment', stackLimit: 1, description: '+100m crush depth for Stingray or PRAWN.' },
  depth_mk2: { id: 'depth_mk2', name: 'Depth Module Mk2', short: 'Depth Mk2', category: 'equipment', stackLimit: 1, description: '+200m crush depth for Stingray or PRAWN.' },
  speed_mod: { id: 'speed_mod', name: 'Speed Module', short: 'Speed Mod', category: 'equipment', stackLimit: 1, description: '+1.5 m/s Stingray, +1.0 m/s Hover Skiff.' },
  storage_mod: { id: 'storage_mod', name: 'Storage Module', short: 'Storage Mod', category: 'equipment', stackLimit: 1, description: '+4 vehicle cargo slots.' },
  power_cell_mk2: { id: 'power_cell_mk2', name: 'Power Cell Mk2', short: 'Cell Mk2', category: 'equipment', stackLimit: 1, description: '+50% vehicle battery capacity.' },
  skiff_boost: { id: 'skiff_boost', name: 'Skiff Boost Module', short: 'Skiff Boost', category: 'equipment', stackLimit: 1, description: '+3 m/s burst for 4s (20s cooldown).' },
  suppressor: { id: 'suppressor', name: 'Rifle Suppressor', short: 'Suppressor', category: 'equipment', stackLimit: 1, description: 'Reduces Plasma Rifle noise by 40% (-10% damage).' },
  ext_mag: { id: 'ext_mag', name: 'Extended Magazine', short: 'Ext. Mag', category: 'equipment', stackLimit: 1, description: 'Increases Plasma Rifle magazine to 40 rounds.' },

  // Alien & Keys
  resonance_plating: { id: 'resonance_plating', name: 'Resonance Plating', short: 'Res. Plate', category: 'equipment', stackLimit: 1, description: '+25% max hull on all vehicles.' },
  pressure_lattice: { id: 'pressure_lattice', name: 'Pressure Lattice', short: 'P-Lattice', category: 'equipment', stackLimit: 1, description: 'Upgrades PRAWN depth rating to 700m.' },
  lattice_key: { id: 'lattice_key', name: 'Lattice Key', short: 'Lattice Key', category: 'key', stackLimit: 1, description: 'Unlocks the Heartspire Seal at 760m.' },
  flight_core: { id: 'flight_core', name: 'Tern Flight Core', short: 'Flight Core', category: 'key', stackLimit: 1, description: 'Recovered avionics core for restoring the Tern Drop Ship.' },
  black_box: { id: 'black_box', name: 'Repuls Black Box', short: 'Black Box', category: 'key', stackLimit: 1, description: 'Bridge command recorder. Decode at an Alien Fabricator.' },
  captains_keycard: { id: 'captains_keycard', name: "Captain's Keycard", short: 'Keycard', category: 'key', stackLimit: 1, description: 'Grants access to the Repuls Bow Armory.' },
  eng_pass: { id: 'eng_pass', name: 'Engineering Pass', short: 'Eng. Pass', category: 'key', stackLimit: 1, description: 'Quartermaster clearance for Repuls Aft Engineering.' },

  // Weapons
  plasma_rifle: { id: 'plasma_rifle', name: 'Plasma Assault Rifle', short: 'Plasma Rifle', category: 'weapon', stackLimit: 1, description: 'Standard Union rifle. 15 dmg, 3/s, 50m noise.' },
  pulse_shotgun: { id: 'pulse_shotgun', name: 'Pulse Shotgun', short: 'Shotgun', category: 'weapon', stackLimit: 1, description: 'Cone shockwave with stagger & knockback. 30 dmg, 70m noise.' },
  ion_sniper: { id: 'ion_sniper', name: 'Ion Sniper', short: 'Ion Sniper', category: 'weapon', stackLimit: 1, description: 'Suppressed long-range precision rifle. 60 dmg (2.5x weak point), 35m noise.' },

  // Vehicles
  stingray: { id: 'stingray', name: 'Stingray Scout Sub', short: 'Stingray', category: 'vehicle', stackLimit: 1, description: 'Agile 250m scout submarine (7 m/s, 100 HP, 6 cargo).' },
  hover_skiff: { id: 'hover_skiff', name: 'Hover Skiff', short: 'Hover Skiff', category: 'vehicle', stackLimit: 1, description: 'Land & shallow-river hovercraft (6 m/s, 75 HP, 4 cargo).' },
  prawn: { id: 'prawn', name: 'PRAWN Exosuit', short: 'PRAWN', category: 'vehicle', stackLimit: 1, description: '400m bipedal industrial mech (300 HP, 12 cargo).' },
  prawn_drill: { id: 'prawn_drill', name: 'PRAWN Drill Arm', short: 'Drill Arm', category: 'equipment', stackLimit: 1, description: '+1 ore yield and mines Hardened Deep Trench veins.' },
  prawn_grabber: { id: 'prawn_grabber', name: 'PRAWN Grabber Arm', short: 'Grabber Arm', category: 'equipment', stackLimit: 1, description: 'Clears collapsed cargo walls and moves heavy crates.' },
  prawn_thruster: { id: 'prawn_thruster', name: 'PRAWN Thruster Module', short: 'Thrusters', category: 'equipment', stackLimit: 1, description: '12m jump boost on land, 6 m/s burst underwater.' },
  prawn_cargo: { id: 'prawn_cargo', name: 'PRAWN Cargo Rack', short: 'Cargo Rack', category: 'equipment', stackLimit: 1, description: '+4 PRAWN cargo slots.' },
  bulwark: { id: 'bulwark', name: 'Bulwark Armored Sub', short: 'Bulwark', category: 'vehicle', stackLimit: 1, description: '900m Project Cormorant combat submarine (650 HP, 25% armor).' },
  maelstrom: { id: 'maelstrom', name: 'Maelstrom Supergun', short: 'Maelstrom', category: 'equipment', stackLimit: 1, description: '250 dmg + 50 blast explosive plasma cannon for the Bulwark.' },
  tern_restore: { id: 'tern_restore', name: 'Tern Drop Ship Restoration', short: 'Restore Tern', category: 'vehicle', stackLimit: 1, description: 'Automated VTOL support asset: Aegis Dome, Overwatch, Resupply.' },

  // Base Structures
  small_hab: { id: 'small_hab', name: 'Small Habitat', short: 'Small Hab', category: 'base', stackLimit: 1, description: '120m depth-rated shelter with O2 & 3 sockets.' },
  large_hab: { id: 'large_hab', name: 'Large Habitat', short: 'Large Hab', category: 'base', stackLimit: 1, description: '300m octagon shelter with 6 sockets for bays & Alien Fabricator.' },
  hydroponics: { id: 'hydroponics', name: 'Hydroponics Bay', short: 'Hydroponics', category: 'base', stackLimit: 1, description: 'Grows Gourds, Bloomfruit, and Hydro Cane.' },
  vehicle_bay: { id: 'vehicle_bay', name: 'Vehicle Bay', short: 'Vehicle Bay', category: 'base', stackLimit: 1, description: 'Builds, charges, and repairs vehicles.' },
  med_bay: { id: 'med_bay', name: 'Med Bay', short: 'Med Bay', category: 'base', stackLimit: 1, description: 'Restores health to 100.' },
  water_fab: { id: 'water_fab', name: 'Water Fabricator', short: 'Water Fab', category: 'base', stackLimit: 1, description: 'Generates Hydro Gel hydration packs.' },
  alien_fab: { id: 'alien_fab', name: 'Alien Fabricator', short: 'Alien Fab', category: 'base', stackLimit: 1, description: 'Decodes Pod 07 Black Box & crafts Orrin technology.' },
  std_fab: { id: 'std_fab', name: 'Standard Fabricator', short: 'Std. Fab', category: 'base', stackLimit: 1, description: 'Union crafting station for bases.' },
  workbench: { id: 'workbench', name: 'Workbench', short: 'Workbench', category: 'base', stackLimit: 1, description: 'Crafts depth, tank, suit, and weapon upgrades.' },
  battery_bank: { id: 'battery_bank', name: 'Battery Bank', short: 'Battery Bank', category: 'base', stackLimit: 1, description: 'Stores +300 PU base power.' },
  solar_panel: { id: 'solar_panel', name: 'Solar Panel', short: 'Solar Panel', category: 'base', stackLimit: 1, description: 'Generates 5 PU/min during daylight.' },
  connector: { id: 'connector', name: 'Habitat Connector', short: 'Connector', category: 'base', stackLimit: 1, description: '5m corridor linking habitats.' },
  tern_pad: { id: 'tern_pad', name: 'Tern Landing Pad', short: 'Tern Pad', category: 'base', stackLimit: 1, description: '18m pad required for Tern Drop Ship support on land.' },
  wall_locker: { id: 'wall_locker', name: 'Wall Locker', short: 'Wall Locker', category: 'base', stackLimit: 1, description: '4 storage slots.' },
  storage_locker: { id: 'storage_locker', name: 'Storage Locker', short: 'Locker', category: 'base', stackLimit: 1, description: '16 storage slots.' },
  bunk: { id: 'bunk', name: 'Bunk', short: 'Bunk', category: 'base', stackLimit: 1, description: 'Sleep to skip night, heal, and set respawn point.' },
  work_terminal: { id: 'work_terminal', name: 'Work Terminal', short: 'Terminal', category: 'base', stackLimit: 1, description: 'Quick Databank & Log archive terminal.' },
};

export const RECIPES: RecipeDef[] = [
  // Basic Materials (Standard Fabricator)
  { id: 'r_ti_alloy', output: 'ti_alloy', outputQty: 1, name: 'Titanium Alloy', category: 'Materials', station: 'standard', ingredients: { ti_ore: 2 }, craftTime: 2, powerCost: 0.5, unlockId: 'u_basic_mats', description: '2 Titanium Ore' },
  { id: 'r_si_gel', output: 'si_gel', outputQty: 1, name: 'Silicate Gel', category: 'Materials', station: 'standard', ingredients: { si_dep: 1 }, craftTime: 2, powerCost: 0.5, unlockId: 'u_basic_mats', description: '1 Silicate Deposit' },
  { id: 'r_glass', output: 'glass', outputQty: 1, name: 'Glass', category: 'Materials', station: 'standard', ingredients: { si_gel: 2 }, craftTime: 3, powerCost: 0.5, unlockId: 'u_basic_mats', description: '2 Silicate Gel' },
  { id: 'r_cu_wire', output: 'cu_wire', outputQty: 1, name: 'Copper Wire', category: 'Materials', station: 'standard', ingredients: { cu_ore: 1 }, craftTime: 2, powerCost: 0.5, unlockId: 'u_start', description: '1 Copper Ore' },
  { id: 'r_plasteel', output: 'plasteel', outputQty: 1, name: 'Plasteel', category: 'Materials', station: 'standard', ingredients: { po_ore: 3, ti_alloy: 2 }, craftTime: 5, powerCost: 0.5, unlockId: 'u_plasteel', description: '3 Plasteel Ore + 2 Titanium Alloy' },
  { id: 'r_bat_core', output: 'battery_core', outputQty: 1, name: 'Battery Core', category: 'Materials', station: 'standard', ingredients: { hydro_crystal: 1, cu_wire: 1 }, craftTime: 4, powerCost: 0.5, unlockId: 'u_hydro', description: '1 Hydro Crystal + 1 Copper Wire' },
  { id: 'r_ec', output: 'energy_cell', outputQty: 1, name: 'Energy Cell', category: 'Materials', station: 'standard', ingredients: { salvage: 1, battery_core: 1 }, craftTime: 8, powerCost: 0.5, unlockId: 'u_hydro', description: '1 Salvage + 1 Battery Core' },
  { id: 'r_sup_fil', output: 'sup_filament', outputQty: 1, name: 'Superconductor Filament', category: 'Materials', station: 'standard', ingredients: { sup_ore: 1, cu_wire: 1 }, craftTime: 6, powerCost: 0.5, unlockId: 'u_sup_fil', description: '1 Superconductor Ore + 1 Copper Wire' },
  { id: 'r_recycle', output: 'ti_alloy', outputQty: 1, name: 'Recycle Salvage -> Ti Alloy', category: 'Materials', station: 'standard', ingredients: { salvage: 2 }, craftTime: 3, powerCost: 0.5, unlockId: 'u_start', description: '2 Salvage -> 1 Titanium Alloy' },

  // Ammunition
  { id: 'r_cell_pack', output: 'plasma_cell_pack', outputQty: 1, name: 'Plasma Cell Pack (+30)', category: 'Ammunition', station: 'standard', ingredients: { energy_cell: 1, ti_alloy: 1 }, craftTime: 4, powerCost: 0.5, unlockId: 'u_start', description: '30 rounds for Plasma Rifle' },
  { id: 'r_shell_pack', output: 'plasma_shell_pack', outputQty: 1, name: 'Plasma Shell Pack (+12)', category: 'Ammunition', station: 'standard', ingredients: { energy_cell: 2, ti_alloy: 1 }, craftTime: 4, powerCost: 0.5, unlockId: 'u_armory_weapons', description: '12 shells for Pulse Shotgun' },

  // Tools
  { id: 'r_repair', output: 'repair_tool', outputQty: 1, name: 'Repair Tool', category: 'Tools', station: 'standard', ingredients: { ti_alloy: 2, cu_wire: 1 }, craftTime: 8, powerCost: 0.5, unlockId: 'u_basic_mats', description: 'Repairs machinery, doors, vehicles, suit', oneTime: true },
  { id: 'r_cutter', output: 'laser_cutter', outputQty: 1, name: 'Laser Cutter', category: 'Tools', station: 'standard', ingredients: { ti_alloy: 2, glass: 1, cu_wire: 1, energy_cell: 1 }, craftTime: 10, powerCost: 0.5, unlockId: 'u_cutter', description: 'Cuts sealed Repuls bulkheads', oneTime: true },

  // Consumables
  { id: 'r_medkit', output: 'medkit', outputQty: 1, name: 'Medkit', category: 'Consumables', station: 'standard', ingredients: { si_gel: 1, bloomfruit: 1 }, craftTime: 4, powerCost: 0.5, unlockId: 'u_bloomfruit', description: '+50 Health' },
  { id: 'r_hydro_gel', output: 'hydro_gel', outputQty: 1, name: 'Hydro Gel', category: 'Consumables', station: 'standard', ingredients: { hydro_crystal: 1 }, craftTime: 3, powerCost: 0.5, unlockId: 'u_hydro', description: '+20 Hydration' },
  { id: 'r_ration', output: 'ration_bar', outputQty: 1, name: 'Ration Bar', category: 'Consumables', station: 'standard', ingredients: { gourd: 2 }, craftTime: 3, powerCost: 0.5, unlockId: 'u_hab_advanced', description: '+30 Nutrition' },
  { id: 'r_fillet', output: 'reef_fillet', outputQty: 1, name: 'Reef Fillet', category: 'Consumables', station: 'standard', ingredients: { raw_skitterfin: 1 }, craftTime: 2, powerCost: 0.5, unlockId: 'u_start', description: '+20 Nutrition' },

  // Equipment (Standard & Workbench)
  { id: 'r_o2_mk2', output: 'o2_mk2', outputQty: 1, name: 'Oxygen Tank Mk2 (120s)', category: 'Equipment', station: 'standard', ingredients: { ti_alloy: 2, glass: 1 }, craftTime: 8, powerCost: 0.5, unlockId: 'u_start', description: 'Upgrades O2 tank to 120s', oneTime: true },
  { id: 'r_o2_mk3', output: 'o2_mk3', outputQty: 1, name: 'Oxygen Tank Mk3 (180s)', category: 'Equipment', station: 'workbench', ingredients: { plasteel: 2, glass: 1 }, craftTime: 10, powerCost: 1, unlockId: 'u_plasteel', description: 'Upgrades O2 tank to 180s', oneTime: true },
  { id: 'r_reinf_suit', output: 'reinforced_suit', outputQty: 1, name: 'Reinforced Suit', category: 'Equipment', station: 'workbench', ingredients: { plasteel: 2, energy_cell: 1 }, craftTime: 18, powerCost: 1, unlockId: 'u_cutter', description: '250m safe depth, caustic/rad protection, 22 slots', oneTime: true },
  { id: 'r_depth_mk1', output: 'depth_mk1', outputQty: 1, name: 'Depth Module Mk1 (+100m)', category: 'Upgrades', station: 'workbench', ingredients: { ti_alloy: 2, glass: 1 }, craftTime: 8, powerCost: 1, unlockId: 'u_hangar_upper', description: 'Adds +100m depth to Stingray/PRAWN', oneTime: true },
  { id: 'r_depth_mk2', output: 'depth_mk2', outputQty: 1, name: 'Depth Module Mk2 (+200m)', category: 'Upgrades', station: 'workbench', ingredients: { plasteel: 2, glass: 1 }, craftTime: 10, powerCost: 1, unlockId: 'u_hangar_upper', description: 'Adds +200m depth to Stingray/PRAWN', oneTime: true },
  { id: 'r_speed_mod', output: 'speed_mod', outputQty: 1, name: 'Speed Module', category: 'Upgrades', station: 'workbench', ingredients: { ti_alloy: 1, cu_wire: 1, energy_cell: 1 }, craftTime: 8, powerCost: 1, unlockId: 'u_hangar_upper', description: '+1.5 m/s Stingray, +1 m/s Skiff', oneTime: true },
  { id: 'r_storage_mod', output: 'storage_mod', outputQty: 1, name: 'Storage Module', category: 'Upgrades', station: 'workbench', ingredients: { ti_alloy: 2, si_gel: 1 }, craftTime: 8, powerCost: 1, unlockId: 'u_hangar_upper', description: '+4 cargo slots on Stingray/Bulwark', oneTime: true },
  { id: 'r_cell_mk2', output: 'power_cell_mk2', outputQty: 1, name: 'Power Cell Mk2', category: 'Upgrades', station: 'workbench', ingredients: { ti_alloy: 1, battery_core: 1 }, craftTime: 8, powerCost: 1, unlockId: 'u_hangar_upper', description: '+50% vehicle battery capacity', oneTime: true },
  { id: 'r_skiff_boost', output: 'skiff_boost', outputQty: 1, name: 'Skiff Boost Module', category: 'Upgrades', station: 'workbench', ingredients: { ti_alloy: 1, cu_wire: 1 }, craftTime: 6, powerCost: 1, unlockId: 'u_hangar_upper', description: 'Hover Skiff turbo boost', oneTime: true },
  { id: 'r_suppressor', output: 'suppressor', outputQty: 1, name: 'Rifle Suppressor', category: 'Upgrades', station: 'workbench', ingredients: { ti_alloy: 1, cu_wire: 1 }, craftTime: 6, powerCost: 1, unlockId: 'u_armory_weapons', description: '-40% Plasma Rifle noise (-10% dmg)', oneTime: true },
  { id: 'r_ext_mag', output: 'ext_mag', outputQty: 1, name: 'Extended Magazine', category: 'Upgrades', station: 'workbench', ingredients: { ti_alloy: 1, glass: 1 }, craftTime: 6, powerCost: 1, unlockId: 'u_armory_weapons', description: '40-round Rifle magazine', oneTime: true },

  // Weapons
  { id: 'r_shotgun', output: 'pulse_shotgun', outputQty: 1, name: 'Pulse Shotgun', category: 'Weapons', station: 'standard', ingredients: { ti_alloy: 3, energy_cell: 2 }, craftTime: 12, powerCost: 0.5, unlockId: 'u_armory_weapons', description: 'Close-range stun & knockback cone', oneTime: true },
  { id: 'r_sniper', output: 'ion_sniper', outputQty: 1, name: 'Ion Sniper', category: 'Weapons', station: 'standard', ingredients: { ti_alloy: 4, cu_wire: 2, energy_cell: 2 }, craftTime: 12, powerCost: 0.5, unlockId: 'u_armory_weapons', description: 'Suppressed long-range rail beam', oneTime: true },

  // Vehicles (Vehicle Bay)
  { id: 'r_stingray', output: 'stingray', outputQty: 1, name: 'Stingray Scout Sub', category: 'Vehicles', station: 'vehicle_bay', ingredients: { ti_alloy: 3, energy_cell: 2, glass: 1 }, craftTime: 10, powerCost: 5, unlockId: 'u_hangar_upper', description: '250m underwater scout sub' },
  { id: 'r_skiff', output: 'hover_skiff', outputQty: 1, name: 'Hover Skiff', category: 'Vehicles', station: 'vehicle_bay', ingredients: { ti_alloy: 2, energy_cell: 1 }, craftTime: 8, powerCost: 4, unlockId: 'u_hangar_upper', description: 'Fast land & river traversal craft' },
  { id: 'r_prawn', output: 'prawn', outputQty: 1, name: 'PRAWN Exosuit', category: 'Vehicles', station: 'vehicle_bay', ingredients: { plasteel: 4, sup_filament: 2, alien_biomass: 2 }, craftTime: 14, powerCost: 10, unlockId: 'u_hangar_lower', description: '400m armored industrial mech' },
  { id: 'r_prawn_drill', output: 'prawn_drill', outputQty: 1, name: 'PRAWN Drill Arm', category: 'Vehicle Mods', station: 'vehicle_bay', ingredients: { ti_alloy: 2, cu_wire: 2, sup_filament: 1 }, craftTime: 8, powerCost: 2, unlockId: 'u_hangar_lower', description: 'Mines Hardened veins & +1 ore', oneTime: true },
  { id: 'r_prawn_grab', output: 'prawn_grabber', outputQty: 1, name: 'PRAWN Grabber Arm', category: 'Vehicle Mods', station: 'vehicle_bay', ingredients: { ti_alloy: 2, cu_wire: 1, glass: 1 }, craftTime: 8, powerCost: 2, unlockId: 'u_hangar_lower', description: 'Clears debris & solves Weight Chamber', oneTime: true },
  { id: 'r_prawn_thrust', output: 'prawn_thruster', outputQty: 1, name: 'PRAWN Thruster Module', category: 'Vehicle Mods', station: 'vehicle_bay', ingredients: { sup_filament: 1, ti_alloy: 1, energy_cell: 1 }, craftTime: 8, powerCost: 2, unlockId: 'u_hangar_lower', description: '12m jump & water burst', oneTime: true },
  { id: 'r_prawn_cargo', output: 'prawn_cargo', outputQty: 1, name: 'PRAWN Cargo Rack', category: 'Vehicle Mods', station: 'vehicle_bay', ingredients: { ti_alloy: 2, plasteel: 1 }, craftTime: 8, powerCost: 2, unlockId: 'u_hangar_lower', description: '+4 PRAWN cargo slots', oneTime: true },
  { id: 'r_bulwark', output: 'bulwark', outputQty: 1, name: 'Bulwark Armored Sub', category: 'Vehicles', station: 'vehicle_bay', ingredients: { plasteel: 8, sup_filament: 3, glass: 4, bio_stabilizer: 2, energy_cell: 2 }, craftTime: 18, powerCost: 15, unlockId: 'u_cormorant', description: '900m combat sub for the Abyssal Floor' },
  { id: 'r_maelstrom', output: 'maelstrom', outputQty: 1, name: 'Maelstrom Supergun', category: 'Vehicle Mods', station: 'vehicle_bay', ingredients: { plasteel: 3, sup_filament: 2, bio_stabilizer: 2, energy_cell: 2 }, craftTime: 12, powerCost: 5, unlockId: 'u_cormorant', description: '250 dmg explosive plasma cannon on Bulwark', oneTime: true },
  { id: 'r_tern_restore', output: 'tern_restore', outputQty: 1, name: 'Restore Tern Drop Ship', category: 'Vehicles', station: 'vehicle_bay', ingredients: { flight_core: 1, plasteel: 4, sup_filament: 2, glass: 2, energy_cell: 3 }, craftTime: 16, powerCost: 10, unlockId: 'u_hangar_lower', description: 'Deploys Aegis Dome, Overwatch & Resupply', oneTime: true },

  // Alien Fabricator
  { id: 'r_res_plate', output: 'resonance_plating', outputQty: 1, name: 'Resonance Plating', category: 'Alien Tech', station: 'alien', ingredients: { plasteel: 2, alien_biomass: 1 }, craftTime: 15, powerCost: 5, unlockId: 'u_waystation_murals', description: '+25% max hull on all vehicles (+5 Lattice Alert)', oneTime: true, isAlien: true },
  { id: 'r_p_lattice', output: 'pressure_lattice', outputQty: 1, name: 'Pressure Lattice', category: 'Alien Tech', station: 'alien', ingredients: { glass: 1, sup_filament: 1, alien_biomass: 1 }, craftTime: 18, powerCost: 5, unlockId: 'u_waystation_murals', description: 'Upgrades PRAWN depth rating to 700m (+5 Lattice Alert)', oneTime: true, isAlien: true },
  { id: 'r_lattice_key', output: 'lattice_key', outputQty: 1, name: 'Lattice Key', category: 'Alien Tech', station: 'alien', ingredients: { alien_biomass: 2, bio_stabilizer: 2, sup_filament: 1 }, craftTime: 20, powerCost: 8, unlockId: 'u_lattice_key', description: 'Requires Authority Code. Unlocks Heartspire Seal (+5 Alert)', oneTime: true, isAlien: true },

  // Base Structures (Builder)
  { id: 'b_small_hab', output: 'small_hab', outputQty: 1, name: 'Small Habitat', category: 'Habitats', station: 'builder', ingredients: { ti_alloy: 3, glass: 2 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_basic', description: '120m depth rating, O2 & healing shelter' },
  { id: 'b_large_hab', output: 'large_hab', outputQty: 1, name: 'Large Habitat', category: 'Habitats', station: 'builder', ingredients: { ti_alloy: 5, glass: 4, plasteel: 2 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_advanced', description: '300m depth rating, accommodates Bays & Alien Fab' },
  { id: 'b_connector', output: 'connector', outputQty: 1, name: 'Connector', category: 'Habitats', station: 'builder', ingredients: { ti_alloy: 1, si_gel: 1 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_basic', description: '5m corridor section' },
  { id: 'b_std_fab', output: 'std_fab', outputQty: 1, name: 'Standard Fabricator', category: 'Stations', station: 'builder', ingredients: { ti_alloy: 2, glass: 1, cu_wire: 2 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_advanced', description: 'Craft materials, tools, and weapons' },
  { id: 'b_workbench', output: 'workbench', outputQty: 1, name: 'Workbench', category: 'Stations', station: 'builder', ingredients: { ti_alloy: 3, cu_wire: 2 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_advanced', description: 'Craft suit, tank, depth & weapon upgrades' },
  { id: 'b_vehicle_bay', output: 'vehicle_bay', outputQty: 1, name: 'Vehicle Bay', category: 'Stations', station: 'builder', ingredients: { ti_alloy: 5, plasteel: 2 }, craftTime: 0, powerCost: 0, unlockId: 'u_hangar_upper', description: 'Build, charge, and repair vehicles' },
  { id: 'b_alien_fab', output: 'alien_fab', outputQty: 1, name: 'Alien Fabricator', category: 'Stations', station: 'builder', ingredients: { plasteel: 3, alien_biomass: 2, sup_filament: 1 }, craftTime: 0, powerCost: 0, unlockId: 'u_alien_fab', description: 'Decode black box & craft Orrin tech' },
  { id: 'b_solar', output: 'solar_panel', outputQty: 1, name: 'Solar Panel', category: 'Power', station: 'builder', ingredients: { ti_alloy: 1, glass: 2, cu_wire: 2 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_advanced', description: 'Generates 5 PU/min during daylight' },
  { id: 'b_battery', output: 'battery_bank', outputQty: 1, name: 'Battery Bank', category: 'Power', station: 'builder', ingredients: { ti_alloy: 2, cu_wire: 2, energy_cell: 1 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_advanced', description: 'Stores +300 PU' },
  { id: 'b_hydroponics', output: 'hydroponics', outputQty: 1, name: 'Hydroponics Bay', category: 'Life Support', station: 'builder', ingredients: { ti_alloy: 3, hydro_crystal: 2 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_advanced', description: 'Grows Gourds, Bloomfruit & Hydro Cane' },
  { id: 'b_water_fab', output: 'water_fab', outputQty: 1, name: 'Water Fabricator', category: 'Life Support', station: 'builder', ingredients: { ti_alloy: 2, hydro_crystal: 1 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_advanced', description: 'Generates Hydro Gel' },
  { id: 'b_med_bay', output: 'med_bay', outputQty: 1, name: 'Med Bay', category: 'Life Support', station: 'builder', ingredients: { ti_alloy: 2, energy_cell: 1 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_advanced', description: 'Restores health to 100 (20 PU)' },
  { id: 'b_tern_pad', output: 'tern_pad', outputQty: 1, name: 'Tern Landing Pad', category: 'Support', station: 'builder', ingredients: { ti_alloy: 4, plasteel: 2 }, craftTime: 0, powerCost: 0, unlockId: 'u_hangar_lower', description: '18m pad for Tern Drop Ship (place on land)' },
  { id: 'b_bunk', output: 'bunk', outputQty: 1, name: 'Bunk', category: 'Furniture', station: 'builder', ingredients: { ti_alloy: 2, glass: 1 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_basic', description: 'Skip night, heal & set respawn' },
  { id: 'b_locker', output: 'storage_locker', outputQty: 1, name: 'Storage Locker', category: 'Furniture', station: 'builder', ingredients: { ti_alloy: 2 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_basic', description: '+16 inventory slots capacity' },
  { id: 'b_wall_locker', output: 'wall_locker', outputQty: 1, name: 'Wall Locker', category: 'Furniture', station: 'builder', ingredients: { ti_alloy: 1 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_basic', description: '+4 compact wall storage slots' },
  { id: 'b_terminal', output: 'work_terminal', outputQty: 1, name: 'Work Terminal', category: 'Furniture', station: 'builder', ingredients: { ti_alloy: 1, cu_wire: 1 }, craftTime: 0, powerCost: 0, unlockId: 'u_hab_basic', description: 'Access Databank & Logs' },
];

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  plasma_rifle: {
    id: 'plasma_rifle',
    name: 'Plasma Assault Rifle',
    damage: 15,
    fireRate: 3,
    magSize: 30,
    reloadTime: 1.8,
    effectiveRange: 40,
    maxRange: 90,
    spreadDeg: 1.5,
    noiseRadius: 50,
    uwDamageMult: 0.7,
    uwRangeMult: 0.5,
    ammoType: 'plasma_cell_pack',
    shotsPerUnit: 30,
    weakPointMult: 1.3,
  },
  pulse_shotgun: {
    id: 'pulse_shotgun',
    name: 'Pulse Shotgun',
    damage: 30,
    fireRate: 1,
    magSize: 6,
    reloadTime: 1.2,
    effectiveRange: 12,
    maxRange: 20,
    spreadDeg: 24,
    noiseRadius: 70,
    uwDamageMult: 0.85,
    uwRangeMult: 0.6,
    ammoType: 'plasma_shell_pack',
    shotsPerUnit: 12,
    weakPointMult: 1.2,
  },
  ion_sniper: {
    id: 'ion_sniper',
    name: 'Ion Sniper',
    damage: 60,
    fireRate: 0.5,
    magSize: 6,
    reloadTime: 2.5,
    effectiveRange: 150,
    maxRange: 220,
    spreadDeg: 0.2,
    noiseRadius: 35,
    uwDamageMult: 0.6,
    uwRangeMult: 0.4,
    ammoType: 'energy_cell',
    shotsPerUnit: 6,
    weakPointMult: 2.5,
  },
};

export const MISSIONS: MissionDef[] = [
  { id: '1.01', act: 1, title: 'Impact', location: 'Landfall Cove', cell: 'C5', objective: 'Exit Lifepod 07 and survey Landfall Cove.', rewardText: 'Standard Suit, Plasma Rifle, Scanner, Builder' },
  { id: '1.02', act: 1, title: 'Boot Sequence', location: 'Lifepod 07', cell: 'C5', objective: 'Gather 4 Titanium Ore and 2 Silicate Deposits, then repair Lifepod 07 Fabricator.', rewardText: 'Titanium Alloy, Silicate Gel, Glass & Repair Tool', waypoint: { ...LANDMARKS.lifepod07, y: 1, label: 'Lifepod 07' } },
  { id: '1.03', act: 1, title: 'Dry Mouth', location: 'Lifepod 07', cell: 'C5', objective: 'Repair the Water Fabricator (2 Titanium Alloy, 1 Silicate Gel).', rewardText: 'Unlimited safe water & Habitat blueprints', waypoint: { ...LANDMARKS.lifepod07, y: 1, label: 'Lifepod 07' } },
  { id: '1.06', act: 1, title: 'Foothold', location: 'Landfall Cove', cell: 'C5', objective: 'Build a Small Habitat (3 Titanium Alloy, 2 Glass) using Builder [B].', rewardText: 'Large Habitat, Workbench, Solar & Power recipes', waypoint: { ...LANDMARKS.lifepod07, y: 1, label: 'Landfall Base Site' } },
  { id: '1.07', act: 1, title: 'Green Shore', location: 'Jungle Coast', cell: 'C4', objective: 'Venture north to the Jungle Coast and scan Plasteel Ore & Hydro Crystals [F].', rewardText: 'Plasteel, Battery Core & Energy Cell recipes', waypoint: { ...LANDMARKS.rivermouth, y: 4, label: 'Jungle Coast (Rivermouth)' } },
  { id: '1.08', act: 1, title: 'Smoke Ridge', location: 'Ashfall Highlands', cell: 'E2', objective: 'Climb Smoke Ridge (E2) to spot the Repuls crash scar, or follow the beacon east.', rewardText: 'Repuls crash site mapped', waypoint: { ...LANDMARKS.smokeRidge, y: 95, label: 'Smoke Ridge' } },
  { id: '1.09', act: 1, title: 'The Furrow', location: 'Crash Coast', cell: 'F4', objective: 'Follow the Furrow scar to the Repuls Midship entrance (The Gash).', rewardText: 'Repuls Midship unlocked', waypoint: { ...LANDMARKS.repulsMid, y: 8, label: 'Repuls Midship' } },
  { id: '2.01', act: 2, title: 'Quarters', location: 'Repuls Midship', cell: 'F4', objective: 'Craft a Repair Tool, enter Midship Crew Quarters, and open the Damage Control Locker.', rewardText: 'Laser Cutter & Reinforced Suit blueprints', waypoint: { ...LANDMARKS.repulsMid, y: 8, label: 'Repuls Crew Quarters' } },
  { id: '2.02', act: 2, title: 'Cut Through', location: 'Repuls Midship', cell: 'F4', objective: 'Craft the Laser Cutter and cut into the Cargo Hold for the Engineering Pass.', rewardText: 'Engineering Pass & Salvage', waypoint: { ...LANDMARKS.repulsMid, y: 8, label: 'Repuls Cargo Hold' } },
  { id: '2.03', act: 2, title: 'Hangar Records', location: 'Repuls Hangar Upper', cell: 'F4', objective: 'Restore Auxiliary Power at the Hangar Maintenance Junction (Repair Tool + 2 Copper Wire).', rewardText: 'Stingray, Hover Skiff & Vehicle Bay blueprints', waypoint: { ...LANDMARKS.repulsMid, y: 8, label: 'Repuls Hangar Upper' } },
  { id: '2.07', act: 2, title: 'The Bridge', location: 'Repuls Bow', cell: 'G5', objective: 'Wear a Reinforced Suit, dive to the Repuls Bow Breach (14m), and recover the Black Box & Keycard.', rewardText: "Black Box, Captain's Keycard & Armory access", waypoint: { ...LANDMARKS.repulsBow, y: -14, label: 'Repuls Bow Breach' } },
  { id: '2.08', act: 2, title: 'Armory Run', location: 'Repuls Bow', cell: 'G5', objective: "Open the Bow Armory using the Captain's Keycard and Laser Cutter.", rewardText: 'Shotgun, Ion Sniper & Bulwark blueprints', waypoint: { ...LANDMARKS.repulsBow, y: -18, label: 'Repuls Bow Armory' } },
  { id: '2.09', act: 2, title: 'Cold Reactor', location: 'Repuls Aft', cell: 'D3', objective: 'Enter Repuls Aft Engineering and solve the Coolant Loop valve sequence.', rewardText: '4 Superconductor Filaments & Main Power', waypoint: { ...LANDMARKS.repulsAft, y: 12, label: 'Repuls Aft Reactor' } },
  { id: '2.10', act: 2, title: 'The Lower Bay', location: 'Repuls Hangar Lower', cell: 'F4', objective: 'Dive into the powered Hangar Lower Bay and recover the Tern Flight Core.', rewardText: 'PRAWN & Tern Drop Ship blueprints', waypoint: { ...LANDMARKS.repulsMid, y: -6, label: 'Repuls Hangar Lower' } },
  { id: '2.12', act: 2, title: 'Waystation Alpha', location: 'Cavern Reef', cell: 'D7', objective: 'Dive The Throat (B4) into Cavern Reef and open Waystation Alpha.', rewardText: 'Alien Fabricator & Orrin tech blueprints', waypoint: { ...LANDMARKS.waystationAlpha, y: -85, label: 'Waystation Alpha' } },
  { id: '3.01', act: 3, title: 'Terraces', location: 'Upper Trench', cell: 'G6', objective: 'Build Stingray / Depth Module Mk2, mine Superconductor Ore and Bio-Plasma Stabilizers.', rewardText: 'Deep Trench materials', waypoint: { ...LANDMARKS.emberTerraces, y: -360, label: 'Ember Terraces' } },
  { id: '3.02', act: 3, title: 'Decode', location: 'Base', cell: 'C5', objective: 'Build an Alien Fabricator in a Large Habitat to decode Pod 07 Black Box.', rewardText: "Captain's Authority Code & Lattice Key blueprint", waypoint: { ...LANDMARKS.lifepod07, y: 1, label: 'Home Base' } },
  { id: '3.04', act: 3, title: 'Project Cormorant', location: 'Vehicle Bay', cell: 'C5', objective: 'Build the Bulwark Armored Sub, mount the Maelstrom Supergun, and craft the Lattice Key.', rewardText: '900m combat submarine & Seal Key', waypoint: { ...LANDMARKS.lifepod07, y: 1, label: 'Vehicle Bay' } },
  { id: '3.07', act: 3, title: 'The Seal', location: 'The Heartspire', cell: 'H8', objective: 'Pilot the Bulwark to 760m in cell H8 and unlock the Heartspire Seal.', rewardText: 'Entry to the Heartspire', waypoint: { ...LANDMARKS.heartspire, y: -760, label: 'The Heartspire (760m)' } },
  { id: '3.08', act: 3, title: 'Outer Ring', location: 'The Heartspire', cell: 'H8', objective: 'Complete all three Node Chambers (Tide, Echo, Weight) to unlock the Core Chamber.', rewardText: 'Core Chamber access', waypoint: { ...LANDMARKS.heartspire, y: -760, label: 'Heartspire Nodes' } },
  { id: '3.09', act: 3, title: 'The Custodian & The Choice', location: 'Core Chamber', cell: 'H8', objective: 'Confront the Custodian, hear Captain Varga’s Echo, and decide the Lattice’s fate.', rewardText: 'Disable or Destroy the Lattice', waypoint: { ...LANDMARKS.heartspire, y: -780, label: 'Heartspire Core' } },
];

export const LOGS: LogDef[] = [
  {
    id: 'log_reyes',
    title: 'Crew Quarters — Marlo Reyes’s Bunk Note',
    speaker: 'Marlo Reyes (Cargo Tech)',
    location: 'Repuls Midship Quarters',
    category: 'repuls',
    body: '“07-D, if you’re reading this I owe you twenty credits. Don’t know what Varga and Okafor were screaming about behind the wardroom door last night, but XO stormed out white as bone. Stay near Pod 07 if drills go hot.”',
  },
  {
    id: 'log_rourke',
    title: 'Cargo Manifest — Directive Nine',
    speaker: 'Dell Rourke (Quartermaster)',
    location: 'Repuls Cargo Hold',
    category: 'repuls',
    body: '“Sealed Union crate loaded at Kessin Station under Directive Nine. No manifest weight, no customs stamp. Just a Resonance Probe housing and orders that Specialist 07-D guards the hatch. Above my paygrade.”',
  },
  {
    id: 'log_okafor',
    title: 'Bridge Black Box — Final Argument',
    speaker: 'Cmdr. Teodor Okafor & Capt. Ilse Varga',
    location: 'Repuls Bow Bridge',
    category: 'repuls',
    body: 'Okafor: “That pulse isn’t passive telemetry, Ilse—it’s a military wake-ping! I will drag you through every court in the Terran Union if we die!”\nVarga: “Launch the Resonance Probe, Lieutenant. Pod 07 holds what the mission needs. Do not let it fall to the Union. Do not let it fall to the planet.”',
  },
  {
    id: 'log_sato',
    title: 'Armory Log — Resonance Probe Launch',
    speaker: 'Lt. Hana Sato (Weapons Officer)',
    location: 'Repuls Bow Armory',
    category: 'repuls',
    body: '“I loaded the Resonance Probe on a direct order at T-minus 22. It wasn’t self-defense. There were no ships on scope—only a structured lattice asleep beneath the trench. Twenty minutes later the sea answered.”',
  },
  {
    id: 'log_menon',
    title: 'Engineering Log — Coolant Loop & Surge',
    speaker: 'Priya Menon (Chief Engineer)',
    location: 'Repuls Aft Engineering',
    category: 'repuls',
    body: '“The reactor surge matched the Probe’s exact harmonic frequency—the alien mesh didn’t hit us with missiles, it back-fed our own grid. To anyone resetting the loop: Bypass (B) first, always. Primary (A) second. Return (C) last. Then pray.”',
  },
  {
    id: 'log_amadi',
    title: 'Science Log — The Orrin Signal',
    speaker: 'Dr. Chidi Amadi (Xenologist)',
    location: 'Waystation Alpha',
    category: 'repuls',
    body: '“The structures down here are 40,000 years old. The Orrin didn’t build a fortress—they built a planetary thermostat over the trench vents. We kicked a sleeping guardian in the teeth.”',
  },
  {
    id: 'log_pod03',
    title: 'Lifepod 03 — Jungle Canopy',
    speaker: 'Crewman Tomas Silva',
    location: 'Cell A2 (Jungle Coast)',
    category: 'pods',
    body: '“Came down hard in the mushroom trees. Something green with three eyes is watching from the vines—it only moves when I look away. Heading toward the sinkhole water.”',
  },
  {
    id: 'log_pod05',
    title: 'Lifepod 05 — Kelp Shelf',
    speaker: 'Ensign Nadia Vance',
    location: 'Cell B8 (Kelp Shelf)',
    category: 'pods',
    body: '“Hull cracked on impact at 40 meters. Something huge slid past the viewport—no eyes, just rows of amber gills listening for my thruster. I cut the power.”',
  },
  {
    id: 'log_pod09',
    title: 'Lifepod 09 — Upper Trench Rim',
    speaker: 'Tech 2nd Class Kenji Mori',
    location: 'Cell E7 (Upper Trench)',
    category: 'pods',
    body: '“Drifted over the canyon lip. Depth gauge reads 190m and the glass is groaning. If anyone finds my beacon, stay out of the trench without heavy armor.”',
  },
  {
    id: 'log_pod11',
    title: 'Lifepod 11 — Ashfall Highlands',
    speaker: 'Marine Cpl. Sara Lind',
    location: 'Cell G2 (Ashfall Highlands)',
    category: 'pods',
    body: '“Landed in black ash. Found a Union launch frame in the next canyon—the Probe casing from the Repuls! Then the obsidian towers started humming as soon as I drew my rifle.”',
  },
  {
    id: 'mural_1',
    title: 'Orrin Mural I — Tide Cities',
    speaker: 'Orrin Archive',
    location: 'Cavern Reef',
    category: 'orrin',
    body: 'Carved glass-bone depicts coastal spires bathed in bioluminescent tides. The Orrin sign their cities with a Spiral, then a Ring, then a Spiral-inside-a-Ring.',
  },
  {
    id: 'mural_2',
    title: 'Orrin Mural II — The Vent Pact',
    speaker: 'Orrin Archive',
    location: 'Waystation Alpha',
    category: 'orrin',
    body: 'The Orrin anchor the Heartspire over the deepest vents, entrusting Theta-9’s climate and defense to the Custodian.',
  },
  {
    id: 'mural_3',
    title: 'Orrin Mural III — The Long Sleep',
    speaker: 'Orrin Archive',
    location: 'Heartspire Outer Ring',
    category: 'orrin',
    body: 'Four ascending crystal harmonic bars guard the Echo Chamber. When weapons are sheathed, the Lattice sees no intruder.',
  },
  {
    id: 'log_varga_final',
    title: 'Decoded Black Box — Captain Varga’s Authority',
    speaker: 'Capt. Ilse Varga',
    location: 'Alien Fabricator',
    category: 'repuls',
    body: '“Directive Nine ordered me to locate and seize the Lattice core for Union weapons research. I believed it would end a war. Instead I killed 145 souls. Specialist 07-D—I launched Pod 07 first with my command key. Finish what I broke.”',
  },
];

export const DATABANK: DatabankEntry[] = [
  { id: 'skitterfin', name: 'Skitterfin', category: 'fauna', biome: 'Shallow Reef', summary: 'Small schooling reef fish. Harmless; cook at a Fabricator for +20 Nutrition.', scansNeeded: 1 },
  { id: 'glass_crab', name: 'Glass Crab', category: 'fauna', biome: 'Shallow Reef', summary: 'Translucent crustacean scavenging sand flats.', scansNeeded: 1 },
  { id: 'burrow_hopper', name: 'Burrow Hopper', category: 'fauna', biome: 'Jungle Coast', summary: 'Timid six-legged herbivore grazing near Veil River.', scansNeeded: 1 },
  { id: 'spore_moth', name: 'Spore Moth', category: 'fauna', biome: 'Jungle Coast', summary: 'Bioluminescent nocturnal pollinator.', scansNeeded: 1 },
  { id: 'lumen_drifter', name: 'Lumen Drifter', category: 'fauna', biome: 'Cavern Reef', summary: 'Drifting jellyfish-like biolight illuminating dark cave vaults.', scansNeeded: 1 },
  { id: 'ash_glider', name: 'Ash Glider', category: 'fauna', biome: 'Ashfall Highlands', summary: 'Thermal-soaring flyer. Territorial only near basalt nests.', scansNeeded: 1 },
  { id: 'slagback', name: 'Slagback', category: 'fauna', biome: 'Ashfall Highlands', summary: 'Heavy plated herbivore (400 HP). Charges if provoked.', scansNeeded: 1 },
  { id: 'snapjaw', name: 'Snapjaw', category: 'fauna', biome: 'Shallow Reef', summary: 'Aggressive reef predator (90 HP). Hunts in packs of 3 at night. Flees at 20% HP.', weakPoint: 'Head / low HP flee', scansNeeded: 2 },
  { id: 'voltaic_eel', name: 'Voltaic Eel', category: 'fauna', biome: 'Cavern Reef', summary: '4.5m electric ambush predator (140 HP). Glows 5s before discharging 18 arc dmg + stun.', weakPoint: 'Takes 1.5x dmg for 4s after discharging', scansNeeded: 2 },
  { id: 'hollowmaw', name: 'Hollowmaw', category: 'fauna', biome: 'Cavern Reef', summary: 'Ceiling-clinging ambush worm (120 HP). Avoids bright lights.', weakPoint: 'Open mouth ring', scansNeeded: 2 },
  { id: 'veilstalker', name: 'Veilstalker', category: 'fauna', biome: 'Jungle Coast', summary: 'Camouflaged prismatic quadruped (160 HP). Active at dusk & dawn.', weakPoint: 'Scanner & movement break stealth', scansNeeded: 2 },
  { id: 'abyssal_lancer', name: 'Abyssal Lancer', category: 'fauna', biome: 'Deep Trench', summary: '5.5m spear-nosed trench hunter (600 HP). Lowers head before high-speed charge.', weakPoint: 'Unarmored flanks during turn', scansNeeded: 2 },
  { id: 'lanternback', name: 'Lanternback Leviathan', category: 'leviathan', biome: 'Deep Trench', summary: '45m deep-water angler leviathan (2,500 HP). Golden lure attracts prey.', weakPoint: 'Glowing Lure Sac (2x dmg)', scansNeeded: 3 },
  { id: 'dredgemaw', name: 'Dredgemaw Leviathan', category: 'leviathan', biome: 'Deep Trench', summary: '70m blind trench dredger (4,000 HP). Completely blind; hears noise at 2x range (150m).', weakPoint: 'Amber Gill Slits (1.5x dmg)', scansNeeded: 3 },
  { id: 'warden', name: 'Warden Leviathan', category: 'lattice', biome: 'Abyssal Floor', summary: '90m serpentine Lattice guardian (6,000 HP). Patrols Heartspire approach. Slip past silently with lights off or destroy with Bulwark.', weakPoint: '3 Cyan Coolant Nodes', scansNeeded: 3 },
  { id: 'seeker', name: 'Lattice Seeker', category: 'lattice', biome: 'Trench / Raids', summary: 'Fast 0.5m dart drone (40 HP). Dispatched in swarms when Lattice Alert reaches 50.', scansNeeded: 1 },
  { id: 'guardian_drone', name: 'Guardian Drone', category: 'lattice', biome: 'Orrin Sites', summary: 'Armored hovering ring (200 HP, 30% armor). Destroying them raises Lattice Alert (+3).', weakPoint: 'Central Cyan Eye (2x dmg)', scansNeeded: 2 },
  { id: 'sentinel_spire', name: 'Sentinel Spire', category: 'lattice', biome: 'Highlands / Heartspire', summary: '8m sensor pillar (500 HP). Fires 15 DPS beam ONLY at targets holding a drawn weapon. Holster [X] to pass safely.', weakPoint: 'Holster weapon to pacify', scansNeeded: 1 },
  { id: 'custodian', name: 'The Custodian', category: 'lattice', biome: 'Heartspire Core', summary: 'Central Orrin planetary governor. Protects Theta-9 geothermal equilibrium.', weakPoint: 'Exposed Core during heat vent & Phase 4', scansNeeded: 1 },
  { id: 'plasteel_ore_scan', name: 'Plasteel Ore', category: 'tech', biome: 'Jungle / Trench', summary: 'High-tensile composite ore. Unlocks Plasteel & Oxygen Tank Mk3.', scansNeeded: 1 },
  { id: 'hydro_crystal_scan', name: 'Hydro Crystal', category: 'tech', biome: 'Jungle Coast', summary: 'Moisture-dense lattice crystal. Unlocks Battery Core, Energy Cell & Hydro Gel.', scansNeeded: 1 },
  { id: 'bloomfruit_scan', name: 'Bloomfruit Flora', category: 'flora', biome: 'Jungle Coast', summary: 'Nutrient-rich fruit. Unlocks Medkit crafting.', scansNeeded: 1 },
];
