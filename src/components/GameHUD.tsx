import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Backpack,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Droplets,
  Gamepad2,
  Hammer,
  Hand,
  Heart,
  Lightbulb,
  Radar,
  RotateCw,
  ScanLine,
  Scissors,
  Shield,
  Utensils,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import { GameSnapshot, ToolMode, WeaponId } from '../game/types';
import { ITEMS, LANDMARKS, MISSIONS, WEAPONS } from '../game/data';
import { sound } from '../game/audio';

interface GameHUDProps {
  snap: GameSnapshot;
  onSelectWeapon: (w: WeaponId) => void;
  onSelectTool: (t: ToolMode) => void;
  onToggleHolster: () => void;
  onCycleSlot: (dir: 1 | -1) => void;
  onReload: () => void;
  onOpenModal: (m: GameSnapshot['activeModal']) => void;
  onInteract: () => void;
  onTogglePilot: () => void;
  onToggleLights: () => void;
  onVehicleBoost: () => void;
  onRotateBuild: (deltaDeg: number) => void;
  onPlaceBuild: () => void;
  onCancelBuild: () => void;
  onDeconstruct: () => void;
  onFireChange: (active: boolean) => void;
  onScanChange: (active: boolean) => void;
  onTouchInput: (jx: number, jy: number, vert: number, fire: boolean, scan?: boolean, sprint?: boolean) => void;
}

const COMPASS_LABELS: Array<{ deg: number; label: string; major?: boolean }> = [
  { deg: 0, label: 'N', major: true },
  { deg: 45, label: 'NE' },
  { deg: 90, label: 'E', major: true },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S', major: true },
  { deg: 225, label: 'SW' },
  { deg: 270, label: 'W', major: true },
  { deg: 315, label: 'NW' },
];

const COMPASS_TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

function wrapAngleDeg(deg: number): number {
  return ((deg % 360) + 540) % 360 - 180;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  snap,
  onSelectWeapon,
  onSelectTool,
  onToggleHolster,
  onCycleSlot,
  onReload,
  onOpenModal,
  onInteract,
  onTogglePilot,
  onToggleLights,
  onVehicleBoost,
  onRotateBuild,
  onPlaceBuild,
  onCancelBuild,
  onDeconstruct,
  onFireChange,
  onScanChange,
  onTouchInput,
}) => {
  const mapRef = useRef<HTMLCanvasElement | null>(null);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const stickPointerId = useRef<number | null>(null);

  const [muted, setMuted] = useState(sound.isMuted());
  const [showControls, setShowControls] = useState(true);
  const [showRadar, setShowRadar] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : true));
  const [stickKnob, setStickKnob] = useState({ x: 0, y: 0, active: false, sprinting: false });
  const inputRef = useRef({ jx: 0, jy: 0, vert: 0, fire: false, scan: false, sprint: false });

  const o2Pct = (snap.o2 / Math.max(1, snap.o2Max)) * 100;
  const isLowO2 =
    !snap.creative &&
    snap.inWater &&
    !snap.inLifepod &&
    !snap.inHabitat &&
    !snap.inHeartspire &&
    (!snap.piloting || snap.piloting.type === 'hover_skiff') &&
    o2Pct < 20;
  const isCriticalO2 = isLowO2 && o2Pct < 10;

  // Audio alert loop when O2 drops below 20% while exploring underwater
  useEffect(() => {
    if (!isLowO2 || snap.paused || snap.ending) return;
    sound.playOxygenAlert(isCriticalO2);
    const intervalMs = isCriticalO2 ? 1700 : 3200;
    const id = window.setInterval(() => {
      sound.playOxygenAlert(isCriticalO2);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isLowO2, isCriticalO2, snap.paused, snap.ending]);

  const pushInput = () => {
    const s = inputRef.current;
    onTouchInput(s.jx, s.jy, s.vert, s.fire, s.scan, s.sprint);
  };

  // Draw 2D tactical sonar radar minimap
  useEffect(() => {
    if (!showRadar) return;
    const canvas = mapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = 104;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#051019';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(42, 214, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 22, 0, Math.PI * 2);
    ctx.arc(size / 2, size / 2, 42, 0, Math.PI * 2);
    ctx.moveTo(size / 2, 4);
    ctx.lineTo(size / 2, size - 4);
    ctx.moveTo(4, size / 2);
    ctx.lineTo(size - 4, size / 2);
    ctx.stroke();

    const scale = size / 600;
    for (const ent of snap.minimapEntities) {
      const dx = (ent.x - snap.x) * scale;
      const dz = (ent.z - snap.z) * scale;
      if (Math.abs(dx) > size / 2 || Math.abs(dz) > size / 2) continue;
      ctx.fillStyle =
        ent.kind === 'base'
          ? '#2ad6ff'
          : ent.kind === 'vehicle'
          ? '#4eff9f'
          : ent.kind === 'leviathan'
          ? '#ff4d4d'
          : ent.kind === 'enemy'
          ? '#ff8a24'
          : ent.kind === 'orrin'
          ? '#b88aff'
          : ent.kind === 'cache'
          ? '#ffe45e'
          : '#e8641b';
      const r = ent.kind === 'leviathan' ? 3.2 : 2.1;
      ctx.fillRect(size / 2 + dx - r, size / 2 + dz - r, r * 2, r * 2);
    }

    if (snap.activeWaypoint) {
      const wx = snap.activeWaypoint.x - snap.x;
      const wz = snap.activeWaypoint.z - snap.z;
      const ang = Math.atan2(wz, wx);
      const dist = Math.min(44, Math.hypot(wx, wz) * scale);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(size / 2 + Math.cos(ang) * dist, size / 2 + Math.sin(ang) * dist, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-snap.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [snap, showRadar]);

  // Analog Joystick pointer handlers
  const updateJoystickFromEvent = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    const nx = dx / maxR;
    const ny = -dy / maxR;
    const mag = Math.min(1, dist / maxR);
    const sprinting = mag > 0.82;

    inputRef.current.jx = Math.abs(nx) < 0.08 ? 0 : nx;
    inputRef.current.jy = Math.abs(ny) < 0.08 ? 0 : ny;
    inputRef.current.sprint = sprinting;
    setStickKnob({ x: dx, y: dy, active: true, sprinting });
    pushInput();
  };

  const resetJoystick = () => {
    stickPointerId.current = null;
    inputRef.current.jx = 0;
    inputRef.current.jy = 0;
    inputRef.current.sprint = false;
    setStickKnob({ x: 0, y: 0, active: false, sprinting: false });
    pushInput();
  };

  const activeMission = MISSIONS.find((m) => m.id === snap.activeMissionId);
  const wpDist = snap.activeWaypoint
    ? Math.round(Math.hypot(snap.activeWaypoint.x - snap.x, snap.activeWaypoint.y - snap.y, snap.activeWaypoint.z - snap.z))
    : null;

  const wStats = WEAPONS[snap.weapon];
  const maxMag = snap.weapon === 'plasma_rifle' && snap.hasExtMag ? 40 : wStats.magSize;
  const reserveCount =
    snap.weapon === 'plasma_rifle'
      ? snap.reserveAmmo.plasma_cells
      : snap.weapon === 'pulse_shotgun'
      ? snap.reserveAmmo.plasma_shells
      : snap.reserveAmmo.energy_cells * 6;

  const headingDeg = ((-snap.yaw * 180) / Math.PI + 3600) % 360;

  let wpDeltaDeg: number | null = null;
  if (snap.activeWaypoint) {
    const dx = snap.activeWaypoint.x - snap.x;
    const dz = snap.activeWaypoint.z - snap.z;
    const wpDeg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
    wpDeltaDeg = wrapAngleDeg(wpDeg - headingDeg);
  }

  // Lifepod 07 home beacon on compass
  const podDx = LANDMARKS.lifepod07.x - snap.x;
  const podDz = LANDMARKS.lifepod07.z - snap.z;
  const podDeg = ((Math.atan2(podDx, -podDz) * 180) / Math.PI + 360) % 360;
  const podDeltaDeg = wrapAngleDeg(podDeg - headingDeg);
  const podDist = Math.round(Math.hypot(podDx, podDz));

  const depthRounded = Math.round(snap.depth);
  const depthPctSafe = Math.min(100, Math.max(0, (snap.depth / Math.max(1, snap.safeDepth)) * 100));
  const depthDanger = snap.depth > snap.safeDepth;
  const depthWarn = !depthDanger && snap.depth > snap.safeDepth - 20 && snap.depth > 10;

  const o2Color = isLowO2 ? '#ef4444' : o2Pct <= 35 ? '#f59e0b' : '#2ad6ff';
  const equippedChargePct = snap.holstered
    ? 0
    : snap.tool === 'weapon'
    ? (snap.magAmmo[snap.weapon] / Math.max(1, maxMag)) * 100
    : snap.tool === 'scanner' && snap.scanProgress > 0
    ? snap.scanProgress * 100
    : 100;

  const useActionLabel = snap.promptText?.includes('Exit Lifepod')
    ? 'EXIT'
    : snap.promptText?.includes('Enter Lifepod')
    ? 'ENTER'
    : snap.promptText?.includes('Board')
    ? 'BOARD'
    : snap.promptText?.includes('Gather')
    ? 'GRAB'
    : 'USE';

  const renderToolIcon = (size = 18, tMode: ToolMode = snap.tool, wId: WeaponId = snap.weapon, holst = snap.holstered) => {
    if (holst) return <Hand size={size} className="text-[#8ea5b8]" />;
    if (tMode === 'scanner') return <ScanLine size={size} className="text-[#2ad6ff]" />;
    if (tMode === 'repair') return <Wrench size={size} className="text-[#4eff9f]" />;
    if (tMode === 'cutter') return <Scissors size={size} className="text-[#ff9f43]" />;
    if (tMode === 'builder') return <Hammer size={size} className="text-[#2ad6ff]" />;
    if (wId === 'pulse_shotgun') return <Crosshair size={size} className="text-[#ffbe82]" />;
    if (wId === 'ion_sniper') return <Crosshair size={size} className="text-[#8be3ff]" />;
    return <Crosshair size={size} className="text-[#e6edf3]" />;
  };

  const craftJob = snap.craftingJob;
  const craftPct = craftJob
    ? Math.min(100, Math.max(0, ((craftJob.total - craftJob.remaining) / Math.max(0.1, craftJob.total)) * 100))
    : 0;
  const craftItem = craftJob ? ITEMS[craftJob.output] : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden select-none text-[#e6edf3]">
      {/* Low Oxygen (< 20%) Perimeter Visual Alert Vignette */}
      {isLowO2 && (
        <div
          className="pointer-events-none fixed inset-0 transition-opacity duration-300"
          style={{
            background: isCriticalO2
              ? 'radial-gradient(circle at center, transparent 48%, rgba(239, 68, 68, 0.42) 100%)'
              : 'radial-gradient(circle at center, transparent 56%, rgba(239, 68, 68, 0.28) 100%)',
          }}
        />
      )}

      {/* Refined Subnautica-inspired Dive Mask Visor Rim (Sleek & non-obstructive) */}
      <svg
        className="pointer-events-none fixed inset-0 h-full w-full"
        viewBox="0 0 1000 562"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,0 L1000,0 L1000,562 L0,562 Z M52,10 Q500,2 948,10 Q988,16 990,64 L990,498 Q988,546 942,550 L558,550 Q532,550 518,528 Q500,502 482,528 Q468,550 442,550 L58,550 Q12,546 10,498 L10,64 Q12,16 52,10 Z"
          fill="rgba(4, 9, 15, 0.34)"
          fillRule="evenodd"
        />
        <path
          d="M52,10 Q500,2 948,10 Q988,16 990,64 L990,498 Q988,546 942,550 L558,550 Q532,550 518,528 Q500,502 482,528 Q468,550 442,550 L58,550 Q12,546 10,498 L10,64 Q12,16 52,10 Z"
          fill="none"
          stroke={isLowO2 ? 'rgba(239, 68, 68, 0.85)' : 'rgba(255, 138, 36, 0.36)'}
          strokeWidth="2.2"
        />
      </svg>

      {/* Top-Left: Subnautica Circular Vital Rings Cluster */}
      <div className="origin-top-left scale-85 sm:scale-100 absolute top-3 left-3.5 sm:top-4 sm:left-5 flex flex-col items-start gap-1.5">
        <div className="flex items-center gap-2.5">
          <div className={isLowO2 ? 'rounded-full ring-2 ring-[#ef4444]/85' : ''}>
            <CircularGauge
              size={66}
              stroke={5}
              value={snap.o2}
              max={snap.o2Max}
              color={o2Color}
              bgFill={isLowO2 ? 'rgba(58, 10, 10, 0.92)' : 'rgba(5, 14, 23, 0.88)'}
            >
              <div className="flex flex-col items-center leading-none">
                <span className={`text-[10px] font-bold tracking-wider ${isLowO2 ? 'text-[#ff9c9c]' : 'text-[#8ce0ff]'}`}>
                  O₂
                </span>
                <span className={`font-mono-tabular mt-0.5 text-base font-bold ${isLowO2 ? 'text-[#ffd4d4]' : 'text-white'}`}>
                  {Math.round(snap.o2)}
                </span>
              </div>
            </CircularGauge>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <CircularGauge size={40} stroke={3.5} value={snap.hp} max={snap.maxHp} color="#f43f5e" bgFill="rgba(5, 14, 23, 0.88)">
                <div className="flex flex-col items-center leading-none">
                  <Heart size={10} className="text-[#f43f5e]" />
                  <span className="font-mono-tabular text-[10px] font-bold">{Math.round(snap.hp)}</span>
                </div>
              </CircularGauge>

              <CircularGauge size={40} stroke={3.5} value={snap.nutrition} max={100} color="#f59e0b" bgFill="rgba(5, 14, 23, 0.88)">
                <div className="flex flex-col items-center leading-none">
                  <Utensils size={10} className="text-[#f59e0b]" />
                  <span className="font-mono-tabular text-[10px] font-bold">{Math.round(snap.nutrition)}</span>
                </div>
              </CircularGauge>

              <CircularGauge size={40} stroke={3.5} value={snap.hydration} max={100} color="#0ea5e9" bgFill="rgba(5, 14, 23, 0.88)">
                <div className="flex flex-col items-center leading-none">
                  <Droplets size={10} className="text-[#38bdf8]" />
                  <span className="font-mono-tabular text-[10px] font-bold">{Math.round(snap.hydration)}</span>
                </div>
              </CircularGauge>
            </div>

            {/* Unboxed Clean Suit & Acoustic Signature Line */}
            <div className="flex items-center gap-1.5 px-0.5 text-[11px] text-[#9fb3c4]">
              <span>{snap.suitTier === 'reinforced' ? 'Reinforced Suit' : 'Dive Suit'}</span>
              <span className="font-mono-tabular text-[#e6edf3]">{Math.round(snap.suitIntegrity)}%</span>
              <span className="hidden text-[#e6edf3]/30 sm:inline" aria-hidden="true">·</span>
              <span className={`hidden font-mono-tabular sm:inline ${snap.noiseRadius > 45 ? 'text-[#ff8a24]' : 'text-[#2ad6ff]'}`}>
                Noise {Math.round(snap.noiseRadius)}m
              </span>
            </div>
          </div>
        </div>

        {(snap.inLifepod || snap.inHabitat) && (
          <div className="flex items-center gap-1.5 border border-[#2ad6ff]/35 bg-[#061824]/88 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#8ce0ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4eff9f]" aria-hidden="true" />
            <span>
              {snap.inLifepod
                ? 'LIFEPOD 07 · PRESSURIZED'
                : `${(snap.inHabitatName ?? 'HABITAT').toUpperCase()} · PRESSURIZED`}
            </span>
          </div>
        )}

        {snap.aegisTimer > 0 && (
          <div className="flex items-center gap-1.5 border border-[#2ad6ff]/45 bg-[#061826]/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#2ad6ff]">
            <Shield size={12} />
            <span className="font-mono-tabular">AEGIS {Math.round(snap.aegisShieldHp)} ({Math.ceil(snap.aegisTimer)}s)</span>
          </div>
        )}
      </div>

      {/* Top-Center: Subnautica Curved Depth Header & Ticked Compass Ribbon */}
      <div className="absolute top-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
        <div className="flex flex-col items-center">
          {/* Subnautica Curved Depth Bracket */}
          <div
            className={`relative flex min-w-[116px] flex-col items-center border px-4 py-1 shadow-lg ${
              depthDanger
                ? 'border-[#ef4444] bg-[#3b0c0c]/95 text-[#ffd2d2]'
                : depthWarn
                ? 'border-[#f59e0b] bg-[#2a1a06]/92 text-[#ffe0a3]'
                : 'border-[#2ad6ff]/45 bg-[#05121d]/90 text-[#e6edf3]'
            }`}
            style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 100%, 0 100%)' }}
          >
            <div className="flex items-baseline gap-1 font-display leading-none">
              {snap.depth > 0.4 ? (
                <>
                  <span className="font-mono-tabular text-base font-bold">{depthRounded}m</span>
                  <span className="font-mono-tabular text-[10px] text-[#8ea5b8]">/ {snap.safeDepth}m</span>
                </>
              ) : (
                <span className="font-mono-tabular text-xs font-bold text-[#7ae582]">
                  {snap.inLifepod ? 'POD 07' : `SURF +${Math.round(snap.elevation)}m`}
                </span>
              )}
            </div>
            {snap.depth > 0.4 && (
              <div className="mt-1 h-0.5 w-full bg-[#132636]">
                <div
                  className={`h-full ${depthDanger ? 'bg-[#ef4444]' : depthWarn ? 'bg-[#f59e0b]' : 'bg-[#2ad6ff]'}`}
                  style={{ width: `${depthPctSafe}%` }}
                />
              </div>
            )}
          </div>

          {/* Ticked Compass Strip with Lifepod + Active Beacon Markers */}
          <div className="relative mt-0.5 h-5 w-44 overflow-hidden border-b border-[#2ad6ff]/30 bg-[#051019]/80 sm:w-64">
            <div className="absolute top-0 left-1/2 z-10 h-2 w-0.5 -translate-x-1/2 bg-[#ff8a24]" />
            {COMPASS_TICKS.map((deg) => {
              const delta = wrapAngleDeg(deg - headingDeg);
              if (Math.abs(delta) > 85) return null;
              const leftPct = 50 + (delta / 85) * 50;
              return (
                <span
                  key={deg}
                  className="absolute top-0 h-1 w-px -translate-x-1/2 bg-[#2ad6ff]/30"
                  style={{ left: `${leftPct}%` }}
                />
              );
            })}
            {COMPASS_LABELS.map((c) => {
              const delta = wrapAngleDeg(c.deg - headingDeg);
              if (Math.abs(delta) > 82) return null;
              const leftPct = 50 + (delta / 85) * 50;
              return (
                <span
                  key={c.label}
                  className={`absolute top-1 -translate-x-1/2 font-display text-[10px] ${
                    c.major ? 'font-bold text-[#e6edf3]' : 'text-[#8ea5b8]/75'
                  }`}
                  style={{ left: `${leftPct}%` }}
                >
                  {c.label}
                </span>
              );
            })}
            {podDist > 25 && Math.abs(podDeltaDeg) <= 84 && (
              <span
                title={`Lifepod 07 (${podDist}m)`}
                className="absolute bottom-0 -translate-x-1/2 text-[9px] font-bold text-[#4eff9f]"
                style={{ left: `${50 + (podDeltaDeg / 85) * 50}%` }}
              >
                ◆
              </span>
            )}
            {wpDeltaDeg !== null && Math.abs(wpDeltaDeg) <= 84 && (
              <span
                className="absolute bottom-0 -translate-x-1/2 text-[9px] font-bold text-[#ffd166]"
                style={{ left: `${50 + (wpDeltaDeg / 85) * 50}%` }}
              >
                ▲
              </span>
            )}
          </div>
        </div>

        {/* Unboxed Location & Time Line */}
        <div className="hidden items-center gap-2 text-[11px] text-[#b8cad8] sm:flex">
          <span className="font-semibold text-[#2ad6ff]">{snap.cell}</span>
          <span aria-hidden="true">·</span>
          <span>{snap.biomeName}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular text-[#8ea5b8]">
            {snap.dayTimeLabel}
            {snap.weather !== 'Calm' ? ` · ${snap.weather}` : ''}
          </span>
        </div>

        {/* Low Oxygen (<20%) Alert Banner */}
        {isLowO2 && (
          <div className="flex items-center gap-2 border border-[#ef4444] bg-[#450a0a]/95 px-3.5 py-1 font-display text-xs font-bold tracking-wider text-[#ffd6d6] shadow-lg">
            <AlertTriangle size={15} className="shrink-0 text-[#ff6b6b]" />
            <span className="font-mono-tabular">
              {isCriticalO2 ? 'CRITICAL OXYGEN' : 'LOW OXYGEN'} ({Math.round(o2Pct)}% · {Math.round(snap.o2)}s) — SURFACE NOW
            </span>
          </div>
        )}

        {activeMission && (
          <div className="hidden max-w-md border border-[#2ad6ff]/20 bg-[#051019]/82 px-3 py-0.5 text-center text-[11px] text-[#c7d6e2] md:block">
            <span className="font-semibold text-[#ff9f43]">{activeMission.title}:</span>{' '}
            {activeMission.objective}
            {wpDist !== null && snap.activeWaypoint && (
              <span className="font-mono-tabular ml-1.5 text-[#ffd166]">
                · {wpDist}m
              </span>
            )}
          </div>
        )}

        {snap.inHazard && (
          <div className="border border-[#ff4d4d] bg-[#3b0c0c]/90 px-3 py-0.5 font-display text-[11px] font-bold tracking-widest text-[#ffb4b4] sm:text-xs">
            WARNING: {snap.inHazard}
          </div>
        )}

        {snap.escapeTimer > 0 && (
          <div className="border border-[#ff4d4d] bg-[#3b0c0c]/95 px-4 py-1 font-display text-xs font-bold text-[#ffd2d2] sm:text-sm">
            CORE OVERLOAD — ESCAPE HEARTSPIRE: {Math.ceil(snap.escapeTimer)}s
          </div>
        )}

        {snap.flags.custodianPhase >= 1 && snap.flags.custodianPhase <= 4 && (
          <div className="w-60 border border-[#ffe9a8]/40 bg-[#090d14]/92 px-3 py-1.5 sm:w-72">
            <div className="flex justify-between text-[11px] font-semibold text-[#ffe9a8]">
              <span>THE CUSTODIAN (P{snap.flags.custodianPhase})</span>
              <span className="font-mono-tabular">{Math.round(snap.flags.custodianHp)} / {snap.flags.custodianMaxHp}</span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-[#1a2230]">
              <div
                className="h-full bg-[#ffe9a8]"
                style={{ width: `${Math.max(0, (snap.flags.custodianHp / snap.flags.custodianMaxHp) * 100)}%` }}
              />
            </div>
            {snap.flags.echoLine && <div className="mt-1 text-[11px] text-[#8be3ff]">{snap.flags.echoLine}</div>}
          </div>
        )}
      </div>

      {/* Top-Right: PDA Buttons, Blueprint Unlock Notification & Sonar Radar */}
      <div className="pointer-events-auto absolute top-3 right-3.5 flex max-w-[172px] flex-col items-end gap-2 sm:top-4 sm:right-5 sm:max-w-none">
        <div className="flex flex-wrap justify-end gap-1.5">
          <RoundHudButton title="PDA: Missions, Sonar Map & Logs [Tab]" onClick={() => onOpenModal({ type: 'databank', tab: 'missions' })}>
            <BookOpen size={15} />
          </RoundHudButton>
          <RoundHudButton title="PDA: Inventory & Vehicle Cargo [I]" onClick={() => onOpenModal({ type: 'inventory' })}>
            <Backpack size={15} />
          </RoundHudButton>
          <RoundHudButton title="Habitat Builder [B]" onClick={() => onOpenModal({ type: 'station', station: 'builder' })}>
            <Hammer size={15} />
          </RoundHudButton>
          <RoundHudButton title="Tern Dropship Support [T]" onClick={() => onOpenModal({ type: 'tern' })}>
            <Zap size={15} />
          </RoundHudButton>
          <RoundHudButton
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={() => {
              const next = !muted;
              sound.setMuted(next);
              setMuted(next);
            }}
          >
            {muted ? <VolumeX size={15} className="text-[#ff8a24]" /> : <Volume2 size={15} />}
          </RoundHudButton>
          <RoundHudButton title={showRadar ? 'Hide Sonar Radar' : 'Show Sonar Radar'} active={showRadar} onClick={() => setShowRadar((v) => !v)}>
            <Radar size={15} />
          </RoundHudButton>
          <RoundHudButton
            title={showControls ? 'Hide On-Screen Controls' : 'Show On-Screen Controls'}
            active={showControls}
            onClick={() => setShowControls((v) => !v)}
          >
            <Gamepad2 size={15} />
          </RoundHudButton>
        </div>

        {/* Subnautica-Style Blueprint / Databank Unlocked Card */}
        {snap.recentUnlock && (
          <button
            onClick={() => onOpenModal({ type: 'databank', tab: 'databank' })}
            className="flex cursor-pointer items-center gap-2.5 border border-[#ff8a24]/55 bg-[#061826]/94 px-3 py-1.5 text-left shadow-lg hover:border-[#2ad6ff]"
          >
            <ScanLine size={16} className="shrink-0 text-[#ff8a24]" />
            <div>
              <div className="text-[10px] font-bold tracking-wider text-[#2ad6ff]">{snap.recentUnlock.title}</div>
              <div className="text-xs font-semibold text-[#ffd166]">{snap.recentUnlock.subtitle}</div>
            </div>
          </button>
        )}

        {showRadar && (
          <div className="flex items-start gap-2 border border-[#2ad6ff]/25 bg-[#051019]/88 p-1.5">
            <div className="flex flex-col gap-0.5 text-right text-[10px]">
              <div className="font-mono-tabular text-[#9fb3c4]">
                Pack {snap.usedSlots}/{snap.maxSlots}
              </div>
              {snap.latticeAlert > 0 && (
                <div className="font-mono-tabular text-[#ff6b6b]">Alert {Math.round(snap.latticeAlert)}/50</div>
              )}
              {snap.bases.length > 0 && (
                <div className="font-mono-tabular text-[#4eff9f]">
                  Power {Math.round(snap.basePower)}/{snap.basePowerCap}
                </div>
              )}
            </div>
            <canvas ref={mapRef} width={104} height={104} className="border border-[#2ad6ff]/25" />
          </div>
        )}
      </div>

      {/* Center Subnautica Reticle + Integrated Scan Ring */}
      <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center">
        <div className="relative flex h-10 w-10 items-center justify-center">
          {snap.scanProgress > 0 && (
            <svg className="absolute inset-0 h-10 w-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(42, 214, 255, 0.25)" strokeWidth="2.5" />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="#2ad6ff"
                strokeWidth="2.5"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - snap.scanProgress)}
              />
            </svg>
          )}
          <div
            className={`h-3.5 w-3.5 rounded-full border ${
              snap.promptText ? 'border-[#2ad6ff] scale-125' : 'border-white/65'
            } transition-transform duration-100`}
          />
          <div className="absolute h-1 w-1 rounded-full bg-white/90" />
        </div>
        {snap.scanProgress > 0 && (
          <div className="mt-1 border border-[#2ad6ff]/45 bg-[#051019]/92 px-3 py-0.5 text-[11px] font-semibold text-[#2ad6ff]">
            <span className="font-mono-tabular">
              {snap.scanTargetName ? `${snap.scanTargetName} · ` : 'Scanning · '}
              {Math.round(snap.scanProgress * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Build Mode Banner & Deconstruct Prompt */}
      {snap.buildingMode && (
        <div
          className="pointer-events-auto absolute top-28 left-1/2 flex max-w-[94vw] -translate-x-1/2 flex-wrap items-center justify-center gap-2.5 border border-[#2ad6ff] bg-[#06121e]/95 px-3.5 py-2 text-xs shadow-xl"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col leading-tight">
            <span className={snap.buildingValid ? 'font-semibold text-[#2ad6ff]' : 'font-semibold text-[#ff6b6b]'}>
              {snap.buildingValid ? 'Placement Valid' : 'Invalid Site'}
              {snap.buildingSnapLabel ? ` · ${snap.buildingSnapLabel}` : ''}
            </span>
            <span className="font-mono-tabular text-[10px] text-[#9fb3c4]">
              Yaw {snap.buildingYawDeg}° · Q/R Rotate · Click/E Build
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onRotateBuild(-45)}
              className="min-h-[34px] cursor-pointer border border-[#e6edf3]/25 bg-[#0b1c2a] px-2.5 py-1 text-[11px] hover:border-[#2ad6ff]"
            >
              -45°
            </button>
            <button
              onClick={() => onRotateBuild(45)}
              className="min-h-[34px] cursor-pointer border border-[#e6edf3]/25 bg-[#0b1c2a] px-2.5 py-1 text-[11px] hover:border-[#2ad6ff]"
            >
              +45°
            </button>
            <button
              onClick={onPlaceBuild}
              disabled={!snap.buildingValid}
              className="min-h-[34px] cursor-pointer border border-[#2ad6ff] bg-[#123d54] px-3 py-1 font-semibold text-white hover:bg-[#195372] disabled:opacity-40"
            >
              Build
            </button>
            <button
              onClick={onCancelBuild}
              className="min-h-[34px] cursor-pointer border border-[#e6edf3]/30 px-2.5 py-1 hover:border-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!snap.buildingMode && snap.deconstructTarget && (
        <div
          className="pointer-events-auto absolute top-28 left-1/2 flex -translate-x-1/2 items-center gap-2.5 border border-[#ff8a24]/70 bg-[#1a1106]/95 px-3.5 py-1.5 text-xs shadow-lg"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-[#ffd166]">Target: {snap.deconstructTarget.name}</span>
          <button
            onClick={onDeconstruct}
            className="min-h-[32px] cursor-pointer border border-[#ff8a24] bg-[#4a2608] px-2.5 py-1 font-semibold text-[#ffe3b3] hover:bg-[#69360b]"
          >
            Deconstruct [G]
          </button>
        </div>
      )}

      {/* Subnautica-Inspired Interactive Prompt */}
      {snap.promptText && (
        <button
          onClick={onInteract}
          className="pointer-events-auto absolute bottom-36 left-1/2 flex min-h-[40px] max-w-[85vw] -translate-x-1/2 cursor-pointer items-center gap-2 border border-[#2ad6ff]/70 bg-[#061522]/92 px-4 py-1.5 font-display text-xs font-semibold tracking-wide text-[#e6edf3] shadow-lg hover:bg-[#0d283d] sm:bottom-36"
        >
          <Hand size={14} className="shrink-0 text-[#2ad6ff]" />
          <span className="truncate">{snap.promptText}</span>
        </button>
      )}

      {/* Live Fabrication Status Card (Visible on HUD whenever craftingJob is active) */}
      {craftJob && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 w-68 max-w-[90vw] -translate-x-1/2 border border-[#ff8a24]/70 bg-[#06121d]/94 px-3.5 py-2.5 shadow-xl sm:w-80">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <Wrench size={14} className="shrink-0 text-[#ff8a24]" />
              <div className="min-w-0">
                <div className="truncate font-display font-bold text-white">
                  Fabricating: {craftJob.name}
                  {craftJob.outputQty > 1 ? ` ×${craftJob.outputQty}` : ''}
                </div>
                {craftItem && (
                  <div className="truncate text-[10px] text-[#8ea5b8]">{craftItem.description}</div>
                )}
              </div>
            </div>
            <div className="font-mono-tabular shrink-0 text-right text-[11px] font-semibold text-[#2ad6ff]">
              <div>{Math.round(craftPct)}%</div>
              <div className="text-[10px] text-[#9fb3c4]">{Math.max(0, craftJob.remaining).toFixed(1)}s</div>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden bg-[#132636]">
            <div
              className="h-full bg-gradient-to-r from-[#ff8a24] to-[#2ad6ff] transition-all duration-100"
              style={{ width: `${craftPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Toast Message */}
      {snap.toastText && (
        <div className="absolute top-32 left-1/2 max-w-[88vw] -translate-x-1/2 border border-[#2ad6ff]/40 bg-[#05111c]/95 px-4 py-1.5 text-center text-xs text-[#e6edf3] shadow-lg sm:max-w-md">
          {snap.toastText}
        </div>
      )}

      {/* Bottom-Left: Subnautica Analog X/Y Joystick + Equipped Tool Ring */}
      {showControls && (
        <div
          className="pointer-events-auto absolute bottom-4 left-3.5 flex flex-col items-start gap-2 sm:bottom-5 sm:left-5 sm:gap-2.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCycleSlot(1)}
              title="Tap to cycle equipped weapon / tool"
              className="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-[#2ad6ff]/55 bg-[#05121d]/90 shadow-lg hover:border-[#2ad6ff] sm:h-14 sm:w-14"
            >
              <svg className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(42,214,255,0.18)" strokeWidth="3.5" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke={snap.holstered ? '#ff8a24' : '#4eff9f'}
                  strokeWidth="3.5"
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={2 * Math.PI * 24 * (1 - equippedChargePct / 100)}
                />
              </svg>
              <div className="flex flex-col items-center">
                {renderToolIcon(17)}
                {snap.tool === 'weapon' && !snap.holstered && (
                  <span className="font-mono-tabular mt-0.5 text-[9px] font-bold text-[#2ad6ff]">
                    {snap.magAmmo[snap.weapon]}/{maxMag}
                  </span>
                )}
              </div>
            </button>

            <div className="flex flex-col gap-1">
              <button
                onClick={onReload}
                disabled={snap.tool !== 'weapon' || snap.holstered}
                title="Reload [R]"
                className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-[#e6edf3]/25 bg-[#05121d]/88 px-2.5 text-[10px] font-semibold hover:border-[#2ad6ff] disabled:opacity-35"
              >
                <RotateCw size={11} />
                <span>{snap.reloadTimer > 0 ? `${snap.reloadTimer.toFixed(1)}s` : 'R'}</span>
              </button>
              <button
                onClick={onToggleHolster}
                title="Holster / Draw [X]"
                className={`flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold ${
                  snap.holstered ? 'border-[#ff8a24] bg-[#36220c]/90 text-[#ffd166]' : 'border-[#e6edf3]/25 bg-[#05121d]/88 hover:border-[#2ad6ff]'
                }`}
              >
                <span>{snap.holstered ? 'Draw' : 'Holster'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div
              ref={stickRef}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                stickPointerId.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                updateJoystickFromEvent(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (stickPointerId.current === e.pointerId) {
                  e.stopPropagation();
                  updateJoystickFromEvent(e.clientX, e.clientY);
                }
              }}
              onPointerUp={(e) => {
                if (stickPointerId.current === e.pointerId) {
                  e.stopPropagation();
                  resetJoystick();
                }
              }}
              onPointerCancel={(e) => {
                if (stickPointerId.current === e.pointerId) {
                  resetJoystick();
                }
              }}
              onLostPointerCapture={() => {
                if (stickPointerId.current !== null) resetJoystick();
              }}
              className={`relative flex h-28 w-28 touch-none items-center justify-center rounded-full border-2 transition-colors sm:h-32 sm:w-32 ${
                stickKnob.sprinting
                  ? 'border-[#ff8a24]/85 bg-[#0a1d2c]/65'
                  : stickKnob.active
                  ? 'border-[#2ad6ff]/80 bg-[#071826]/65'
                  : 'border-[#e6edf3]/35 bg-[#051019]/55'
              }`}
            >
              <div className="pointer-events-none absolute inset-2 rounded-full border border-dashed border-[#e6edf3]/15" />
              <div className="pointer-events-none absolute top-1.5 text-[9px] font-bold text-[#e6edf3]/40">W</div>
              <div className="pointer-events-none absolute bottom-1.5 text-[9px] font-bold text-[#e6edf3]/40">S</div>
              <div className="pointer-events-none absolute left-2 text-[9px] font-bold text-[#e6edf3]/40">A</div>
              <div className="pointer-events-none absolute right-2 text-[9px] font-bold text-[#e6edf3]/40">D</div>

              <div
                className={`pointer-events-none flex h-11 w-11 items-center justify-center rounded-full border shadow-lg sm:h-12 sm:w-12 ${
                  stickKnob.sprinting
                    ? 'border-[#ff8a24] bg-[#ff8a24]/30'
                    : stickKnob.active
                    ? 'border-[#2ad6ff] bg-[#2ad6ff]/25'
                    : 'border-[#e6edf3]/60 bg-[#182c3d]/80'
                }`}
                style={{
                  transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)`,
                }}
              >
                <div className="h-3 w-3 rounded-full bg-white/75" />
              </div>
            </div>

            {stickKnob.sprinting && (
              <span className="mb-1 text-[10px] font-bold tracking-wider text-[#ff8a24]">
                {snap.inWater ? 'FAST' : 'SPRINT'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bottom-Center: Subnautica Quick-Slot Bar & Control Hints */}
      <div
        className="pointer-events-auto absolute bottom-3 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1.5 lg:flex"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 border border-[#2ad6ff]/25 bg-[#051019]/88 px-2 py-1.5">
          {(['plasma_rifle', 'pulse_shotgun', 'ion_sniper'] as WeaponId[]).map((w, i) => {
            const active = !snap.holstered && snap.tool === 'weapon' && snap.weapon === w;
            const owned = snap.ownedWeapons[w] || snap.creative;
            const slotMax = w === 'plasma_rifle' && snap.hasExtMag ? 40 : WEAPONS[w].magSize;
            const pct = (snap.magAmmo[w] / Math.max(1, slotMax)) * 100;
            return (
              <button
                key={w}
                onClick={() => onSelectWeapon(w)}
                disabled={!owned}
                title={WEAPONS[w].name}
                className={`relative flex h-11 w-12 cursor-pointer flex-col items-center justify-center border transition-colors disabled:opacity-30 ${
                  active
                    ? 'border-[#2ad6ff] bg-[#10384e] text-white'
                    : 'border-[#e6edf3]/15 bg-[#0a1824] text-[#9fb3c4] hover:border-[#2ad6ff]/50'
                }`}
              >
                <span className="font-mono-tabular absolute top-0.5 left-1 text-[9px] text-[#2ad6ff]">{i + 1}</span>
                {renderToolIcon(14, 'weapon', w, false)}
                <span className="mt-0.5 text-[9px] font-medium">
                  {w === 'plasma_rifle' ? 'Rifle' : w === 'pulse_shotgun' ? 'Shot' : 'Ion'}
                </span>
                {owned && (
                  <span className="absolute right-1 bottom-0.5 left-1 h-0.5 bg-[#132636]">
                    <span className="block h-full bg-[#4eff9f]" style={{ width: `${pct}%` }} />
                  </span>
                )}
              </button>
            );
          })}

          {(
            [
              { mode: 'scanner' as ToolMode, keyNum: 4, label: 'Scan', enabled: true },
              { mode: 'repair' as ToolMode, keyNum: 5, label: 'Repair', enabled: snap.ownedTools.repair || snap.creative },
              { mode: 'cutter' as ToolMode, keyNum: 6, label: 'Cutter', enabled: snap.ownedTools.cutter || snap.creative },
              { mode: 'builder' as ToolMode, keyNum: 7, label: 'Build', enabled: true },
            ]
          ).map((slot) => {
            const active = !snap.holstered && snap.tool === slot.mode;
            return (
              <button
                key={slot.mode}
                onClick={() => onSelectTool(slot.mode)}
                disabled={!slot.enabled}
                className={`relative flex h-11 w-12 cursor-pointer flex-col items-center justify-center border transition-colors disabled:opacity-30 ${
                  active
                    ? 'border-[#2ad6ff] bg-[#10384e] text-white'
                    : 'border-[#e6edf3]/15 bg-[#0a1824] text-[#9fb3c4] hover:border-[#2ad6ff]/50'
                }`}
              >
                <span className="font-mono-tabular absolute top-0.5 left-1 text-[9px] text-[#2ad6ff]">{slot.keyNum}</span>
                {renderToolIcon(14, slot.mode, snap.weapon, false)}
                <span className="mt-0.5 text-[9px] font-medium">{slot.label}</span>
              </button>
            );
          })}
        </div>

        <div className="px-2 text-[10px] text-[#9fb3c4]">
          {snap.tool === 'weapon' && !snap.holstered && (
            <span className="font-mono-tabular mr-2 font-semibold text-[#2ad6ff]">
              {wStats.name} {snap.magAmmo[snap.weapon]}/{maxMag} (Res {reserveCount}) ·
            </span>
          )}
          WASD Move · Space Ascend · C/Ctrl Dive · Shift Fast Swim · RMB/F Scan · Wheel Cycle
        </div>
      </div>

      {/* Bottom-Right: Vehicle Cockpit Telemetry + Subnautica Vertical Swim Rocker & Action Buttons */}
      <div
        className="pointer-events-auto absolute right-3.5 bottom-4 flex flex-col items-end gap-2 sm:right-5 sm:bottom-5 sm:gap-2.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {snap.piloting && (() => {
          const v = snap.piloting;
          const hullPct = Math.max(0, Math.min(100, (v.hp / Math.max(1, v.maxHp)) * 100));
          const pwrPct = Math.max(0, Math.min(100, (v.power / Math.max(1, v.maxPower)) * 100));
          const depthPct = Math.max(0, Math.min(100, (snap.depth / Math.max(1, v.crushDepth)) * 100));
          const cargoUsed = Object.values(v.cargo).reduce((a, b) => a + (b ?? 0), 0);
          const mods: string[] = [];
          if (v.upgrades.depthMk > 0) mods.push(`Depth Mk${v.upgrades.depthMk}`);
          if (v.upgrades.pressureLattice) mods.push('Lattice');
          if (v.upgrades.speedMod) mods.push('Speed');
          if (v.upgrades.drillArm) mods.push('Drill');
          if (v.upgrades.grabberArm) mods.push('Claw');
          if (v.upgrades.thrusterMod) mods.push('Thruster');
          if (v.upgrades.skiffBoost) mods.push('Boost');
          if (v.upgrades.maelstrom) mods.push(`Maelstrom ${v.maelstromAmmo}`);

          return (
            <div className="w-60 border border-[#2ad6ff]/50 bg-[#05111c]/94 p-2.5 text-xs shadow-xl sm:w-72">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-display text-xs font-bold tracking-wider text-[#2ad6ff]">{v.name}</span>
                <span className="font-mono-tabular shrink-0 text-[11px] font-semibold text-[#e6edf3]">
                  {snap.vehicleSpeed.toFixed(1)} m/s
                </span>
              </div>

              <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <div className="flex justify-between font-mono-tabular text-[#b8cad8]">
                    <span>HULL</span>
                    <span>{Math.round(v.hp)}/{v.maxHp}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full bg-[#132230]">
                    <div className="h-full bg-[#4eff9f]" style={{ width: `${hullPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between font-mono-tabular text-[#b8cad8]">
                    <span>POWER</span>
                    <span>{Math.round(v.power)}/{v.maxPower}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full bg-[#132230]">
                    <div className="h-full bg-[#2ad6ff]" style={{ width: `${pwrPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-1.5">
                <div className="flex justify-between font-mono-tabular text-[10px] text-[#9fb3c4]">
                  <span>CRUSH {depthRounded}m / {v.crushDepth}m</span>
                  <span>CARGO {cargoUsed}/{v.cargoCap}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full bg-[#132230]">
                  <div
                    className={`h-full ${depthPct > 95 ? 'bg-[#ef4444]' : depthPct > 78 ? 'bg-[#f59e0b]' : 'bg-[#38bdf8]'}`}
                    style={{ width: `${depthPct}%` }}
                  />
                </div>
              </div>

              {mods.length > 0 && (
                <div className="mt-1.5 truncate text-[10px] text-[#9adfff]">
                  Mods: {mods.join(' · ')}
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={onToggleLights}
                  className="flex min-h-[34px] flex-1 cursor-pointer items-center justify-center gap-1 border border-[#e6edf3]/25 bg-[#0e1f2e] px-2 py-1 text-[11px] hover:border-[#2ad6ff]"
                >
                  <Lightbulb size={12} />
                  {v.lightsOn ? 'Lights' : 'Stealth'}
                </button>
                {(v.type === 'hover_skiff' || v.type === 'prawn') && (
                  <button
                    onClick={onVehicleBoost}
                    className="min-h-[34px] cursor-pointer border border-[#ff8a24]/55 bg-[#2a1a08] px-2 py-1 text-[11px] font-semibold text-[#ffd166] hover:border-[#ff8a24]"
                  >
                    {v.type === 'hover_skiff' ? (v.boostCd > 0 ? `${Math.ceil(v.boostCd)}s` : 'Boost') : 'Jump'}
                  </button>
                )}
                <button
                  onClick={() => onOpenModal({ type: 'inventory' })}
                  className="min-h-[34px] cursor-pointer border border-[#2ad6ff]/40 bg-[#0d2536] px-2 py-1 text-[11px] hover:border-[#2ad6ff]"
                >
                  Cargo
                </button>
                <button
                  onClick={onTogglePilot}
                  className="min-h-[34px] cursor-pointer border border-[#e6edf3]/30 bg-[#0e1f2e] px-2.5 py-1 text-[11px] hover:border-[#ff8a24]"
                >
                  Exit [V]
                </button>
              </div>
            </div>
          );
        })()}

        {showControls && (
          <div className="flex items-end gap-2 sm:gap-3">
            {/* Circular Subnautica Action Cluster: Interact, Scan, Fire */}
            <div className="flex items-end gap-2 sm:gap-2.5">
              <button
                onClick={onInteract}
                title="Interact / Gather / Enter / Exit [E]"
                className={`flex h-13 w-13 cursor-pointer flex-col items-center justify-center rounded-full border-2 shadow-lg transition-transform active:scale-95 sm:h-14 sm:w-14 ${
                  snap.promptText
                    ? 'border-[#2ad6ff] bg-[#10384f]/95 text-[#2ad6ff]'
                    : 'border-[#e6edf3]/40 bg-[#05121d]/88 text-[#e6edf3]/85 hover:border-[#2ad6ff]'
                }`}
              >
                <Hand size={19} />
                <span className="text-[9px] font-bold">{useActionLabel}</span>
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  inputRef.current.scan = true;
                  onScanChange(true);
                  pushInput();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  inputRef.current.scan = false;
                  onScanChange(false);
                  pushInput();
                }}
                onPointerCancel={() => {
                  inputRef.current.scan = false;
                  onScanChange(false);
                  pushInput();
                }}
                title="Hold to Scan [F / Right-Click]"
                className={`flex h-13 w-13 cursor-pointer touch-none flex-col items-center justify-center rounded-full border-2 shadow-lg transition-transform active:scale-95 sm:h-14 sm:w-14 ${
                  snap.scanProgress > 0
                    ? 'border-[#2ad6ff] bg-[#123c52]/95 text-[#2ad6ff]'
                    : 'border-[#2ad6ff]/55 bg-[#05121d]/88 text-[#9adfff] hover:border-[#2ad6ff]'
                }`}
              >
                <ScanLine size={19} />
                <span className="text-[9px] font-bold">SCAN</span>
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  inputRef.current.fire = true;
                  onFireChange(true);
                  pushInput();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  inputRef.current.fire = false;
                  onFireChange(false);
                  pushInput();
                }}
                onPointerCancel={() => {
                  inputRef.current.fire = false;
                  onFireChange(false);
                  pushInput();
                }}
                title="Fire Weapon / Use Tool [Left-Click]"
                className="flex h-15 w-15 cursor-pointer touch-none flex-col items-center justify-center rounded-full border-2 border-[#ef4444]/75 bg-[#3f1014]/88 text-[#ffb4b4] shadow-lg transition-transform hover:border-[#ef4444] active:scale-95 sm:h-16 sm:w-16"
              >
                <Crosshair size={21} />
                <span className="text-[9px] font-bold">FIRE</span>
              </button>
            </div>

            {/* Vertical Ascend / Dive Rocker */}
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  inputRef.current.vert = 1;
                  pushInput();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  inputRef.current.vert = 0;
                  pushInput();
                }}
                onPointerCancel={() => {
                  inputRef.current.vert = 0;
                  pushInput();
                }}
                title="Ascend / Jump [Space]"
                className="flex h-13 w-11 cursor-pointer touch-none flex-col items-center justify-center rounded-xl border border-[#2ad6ff]/50 bg-[#061624]/88 text-[#7be4ff] shadow-md hover:border-[#2ad6ff] active:bg-[#14435e] sm:h-14 sm:w-12"
              >
                <ChevronUp size={22} />
                <span className="text-[8px] font-bold">UP</span>
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  inputRef.current.vert = -1;
                  pushInput();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  inputRef.current.vert = 0;
                  pushInput();
                }}
                onPointerCancel={() => {
                  inputRef.current.vert = 0;
                  pushInput();
                }}
                title="Dive / Descend [C / Ctrl]"
                className="flex h-13 w-11 cursor-pointer touch-none flex-col items-center justify-center rounded-xl border border-[#2ad6ff]/50 bg-[#061624]/88 text-[#7be4ff] shadow-md hover:border-[#2ad6ff] active:bg-[#14435e] sm:h-14 sm:w-12"
              >
                <ChevronDown size={22} />
                <span className="text-[8px] font-bold">DIVE</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CircularGauge: React.FC<{
  size: number;
  stroke: number;
  value: number;
  max: number;
  color: string;
  bgFill: string;
  children: React.ReactNode;
}> = ({ size, stroke, value, max, color, bgFill, children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)));
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill={bgFill} stroke="rgba(230, 237, 243, 0.16)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="relative z-10">{children}</div>
    </div>
  );
};

const RoundHudButton: React.FC<{
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, active, onClick, children }) => (
  <button
    title={title}
    onClick={onClick}
    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-colors sm:h-9 sm:w-9 ${
      active
        ? 'border-[#2ad6ff] bg-[#10384e]/95 text-[#2ad6ff]'
        : 'border-[#e6edf3]/30 bg-[#05121d]/88 text-[#dce8f2] hover:border-[#2ad6ff] hover:text-white'
    }`}
  >
    {children}
  </button>
);
