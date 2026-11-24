import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MapPin, Navigation } from 'lucide-react';
import { ActiveModal, GameSnapshot } from '../game/types';
import { cellCenter, DATABANK, HALF_WORLD, LANDMARKS, LOGS, MISSIONS, WORLD_SIZE } from '../game/data';
import { getBiomeAt, terrainHeightAt } from '../game/world';
import { PdaShell, PdaSectionKey } from './PdaShell';

interface DatabankModalProps {
  snap: GameSnapshot;
  initialTab: 'missions' | 'logs' | 'map' | 'databank';
  onSetWaypoint: (wp: { x: number; y: number; z: number; label: string } | null) => void;
  onWarp: (x: number, z: number) => void;
  onOpenModal?: (m: ActiveModal) => void;
  onClose: () => void;
}

const BIOME_LEGEND = [
  { label: 'Shallow Reef', color: '#2498a8' },
  { label: 'Jungle Coast', color: '#2b6f47' },
  { label: 'Ashfall Highlands', color: '#5c4e47' },
  { label: 'Crash Coast', color: '#8f795d' },
  { label: 'Cavern Reef', color: '#393f85' },
  { label: 'Deep Trench', color: '#14233b' },
];

export const DatabankModal: React.FC<DatabankModalProps> = ({
  snap,
  initialTab,
  onSetWaypoint,
  onWarp,
  onOpenModal,
  onClose,
}) => {
  const [tab, setTab] = useState<'missions' | 'logs' | 'map' | 'databank'>(initialTab);
  const sonarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Render live bathymetric relief + contour sonar chart when viewing Map tab
  useEffect(() => {
    if (tab !== 'map') return;
    const canvas = sonarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const res = 128;
    const stepX = w / res;
    const stepY = h / res;

    ctx.clearRect(0, 0, w, h);

    for (let gy = 0; gy < res; gy++) {
      for (let gx = 0; gx < res; gx++) {
        const wx = ((gx + 0.5) / res) * WORLD_SIZE - HALF_WORLD;
        const wz = ((gy + 0.5) / res) * WORLD_SIZE - HALF_WORLD;
        const elev = terrainHeightAt(wx, wz);
        const biome = getBiomeAt(wx, wz);

        // Bathymetric + topographic color shading
        let r = 20;
        let g = 40;
        let b = 60;
        if (elev >= 0) {
          const t = Math.min(1, elev / 260);
          if (biome === 'ashfall_highlands') {
            r = 78 + t * 55;
            g = 66 + t * 44;
            b = 62 + t * 38;
          } else if (biome === 'crash_coast') {
            r = 138 + t * 30;
            g = 116 + t * 24;
            b = 88 + t * 20;
          } else {
            r = 34 + t * 24;
            g = 96 + t * 48;
            b = 62 + t * 24;
          }
        } else {
          const depth = -elev;
          if (depth < 55) {
            const d = depth / 55;
            r = 56 - d * 24;
            g = 178 - d * 60;
            b = 184 - d * 36;
          } else if (depth < 220) {
            const d = (depth - 55) / 165;
            r = 44 - d * 18;
            g = 72 - d * 36;
            b = 148 - d * 56;
          } else {
            const d = Math.min(1, (depth - 220) / 540);
            r = 24 - d * 12;
            g = 36 - d * 20;
            b = 78 - d * 42;
          }
        }

        // Subtle contour bands every 45m
        const contour = Math.abs((elev % 45) / 45);
        if (contour < 0.08) {
          r *= 1.18;
          g *= 1.18;
          b *= 1.18;
        }
        // Bright coastline trace right at 0m
        if (Math.abs(elev) < 2.2) {
          r = 122;
          g = 225;
          b = 255;
        }

        ctx.fillStyle = `rgb(${Math.min(255, Math.round(r))},${Math.min(255, Math.round(g))},${Math.min(255, Math.round(b))})`;
        ctx.fillRect(Math.floor(gx * stepX), Math.floor(gy * stepY), Math.ceil(stepX), Math.ceil(stepY));
      }
    }

    // Draw 8x8 sector grid + fog-of-war dim for undiscovered sectors (unless Creative)
    const cellW = w / 8;
    const cellH = h / 8;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const code = `${String.fromCharCode(65 + c)}${r + 1}`;
        const seen = snap.creative || snap.discoveredCells.includes(code);
        if (!seen) {
          ctx.fillStyle = 'rgba(4, 10, 18, 0.72)';
          ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
        }
        ctx.strokeStyle = code === snap.cell ? 'rgba(255, 255, 255, 0.9)' : 'rgba(42, 214, 255, 0.22)';
        ctx.lineWidth = code === snap.cell ? 1.5 : 1;
        ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
        ctx.fillStyle = seen ? 'rgba(230, 237, 243, 0.72)' : 'rgba(159, 179, 196, 0.38)';
        ctx.fillText(code, c * cellW + 4, r * cellH + 12);
      }
    }

    // Landmark pins
    for (const lm of Object.values(LANDMARKS)) {
      const lx = ((lm.x + HALF_WORLD) / WORLD_SIZE) * w;
      const lz = ((lm.z + HALF_WORLD) / WORLD_SIZE) * h;
      ctx.fillStyle = lm.name.includes('Lifepod 07') ? '#4eff9f' : '#ff9f43';
      ctx.beginPath();
      ctx.arc(lx, lz, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Active waypoint ring
    if (snap.activeWaypoint) {
      const wx = ((snap.activeWaypoint.x + HALF_WORLD) / WORLD_SIZE) * w;
      const wz = ((snap.activeWaypoint.z + HALF_WORLD) / WORLD_SIZE) * h;
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wz, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player chevron
    const px = ((snap.x + HALF_WORLD) / WORLD_SIZE) * w;
    const pz = ((snap.z + HALF_WORLD) / WORLD_SIZE) * h;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-snap.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#06111c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [tab, snap.cell, snap.creative, snap.discoveredCells, snap.x, snap.z, snap.yaw, snap.activeWaypoint]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const nz = (e.clientY - rect.top) / rect.height;
    const wx = Math.round(nx * WORLD_SIZE - HALF_WORLD);
    const wz = Math.round(nz * WORLD_SIZE - HALF_WORLD);
    const { code } = { code: `${String.fromCharCode(65 + Math.min(7, Math.floor(nx * 8)))}${Math.min(8, Math.floor(nz * 8)) + 1}` };
    if (snap.creative) {
      onWarp(wx, wz);
    } else {
      onSetWaypoint({ x: wx, y: Math.round(terrainHeightAt(wx, wz)), z: wz, label: `Beacon ${code}` });
    }
  };

  const tabTitles: Record<typeof tab, string> = {
    missions: 'PDA · Mission Directives',
    logs: 'PDA · Voice & Wreck Logs',
    map: 'PDA · Bathymetric Sonar Map',
    databank: 'PDA · Field Databank',
  };

  return (
    <PdaShell
      title={tabTitles[tab]}
      subtitle={`Sector ${snap.cell} · ${snap.biomeName} · ${snap.discoveredCells.length}/64 Sectors Charted`}
      snap={snap}
      activeSection={tab as PdaSectionKey}
      onOpenModal={(m) => {
        if (m && m.type === 'databank') setTab(m.tab);
        else onOpenModal?.(m);
      }}
      onClose={onClose}
    >
      {tab === 'missions' && (
        <div className="space-y-2.5">
          {MISSIONS.map((m) => {
            const done = snap.completedMissions.includes(m.id);
            const active = snap.activeMissionId === m.id;
            return (
              <div
                key={m.id}
                className={`flex flex-wrap items-center justify-between gap-3 border p-3.5 text-xs ${
                  active
                    ? 'border-[#ff8a24]/70 bg-[#18130c]'
                    : done
                    ? 'border-[#4eff9f]/25 bg-[#081716]'
                    : 'border-[#e6edf3]/10 bg-[#091825]'
                }`}
              >
                <div className="max-w-xl">
                  <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-[#e6edf3]">
                    {done && <CheckCircle2 size={14} className="shrink-0 text-[#4eff9f]" />}
                    <span>
                      Act {m.act} · [{m.id}] {m.title}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8ea5b8]">
                    {m.cell} · {m.location}
                  </div>
                  <div className="mt-1 text-[#cbd8e3]">{m.objective}</div>
                  <div className="mt-1 text-[11px] text-[#2ad6ff]">Reward: {m.rewardText}</div>
                </div>
                {m.waypoint && (
                  <button
                    onClick={() => onSetWaypoint(m.waypoint!)}
                    className="flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 border border-[#2ad6ff]/50 bg-[#103449] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#174b68] whitespace-nowrap"
                  >
                    <Navigation size={13} />
                    <span>Set Beacon</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-3">
          {LOGS.filter((l) => snap.creative || snap.discoveredLogs.includes(l.id)).length === 0 ? (
            <div className="border border-[#e6edf3]/10 bg-[#081724] py-12 text-center text-sm text-[#8ea5b8]">
              No voice transmissions or Orrin murals decoded yet. Investigate Repuls wreck sections and Lifepods.
            </div>
          ) : (
            LOGS.filter((l) => snap.creative || snap.discoveredLogs.includes(l.id)).map((l) => (
              <div key={l.id} className="border border-[#2ad6ff]/20 bg-[#081724] p-4 text-xs">
                <div className="font-display text-sm font-semibold text-[#2ad6ff]">{l.title}</div>
                <div className="mt-0.5 text-[11px] text-[#8ea5b8]">
                  {l.speaker} · {l.location}
                </div>
                <div className="mt-2.5 whitespace-pre-line leading-relaxed text-[#dce6ef]">{l.body}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'map' && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-[#9fb3c4]">
              <span>
                3.2 km × 3.2 km Bathymetric Chart · Sector <strong className="text-[#2ad6ff]">{snap.cell}</strong>
              </span>
              <span className="text-[11px] text-[#ff9f43]">
                {snap.creative ? 'Click map to Warp' : 'Click map to Pin Beacon'}
              </span>
            </div>
            <div className="border border-[#2ad6ff]/35 bg-[#040c14] p-1.5">
              <canvas
                ref={sonarCanvasRef}
                width={320}
                height={320}
                onClick={handleMapClick}
                className="aspect-square w-full cursor-crosshair"
              />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#9fb3c4]">
              {BIOME_LEGEND.map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: b.color }} />
                  <span>{b.label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col text-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-[#e6edf3]">Charted Beacons &amp; Landmarks</span>
              {snap.activeWaypoint && (
                <button
                  onClick={() => onSetWaypoint(null)}
                  className="cursor-pointer text-[11px] text-[#ff9f43] hover:underline"
                >
                  Clear Beacon
                </button>
              )}
            </div>
            <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {Object.values(LANDMARKS).map((lm) => (
                <div
                  key={lm.name}
                  className="flex items-center justify-between gap-2 border border-[#e6edf3]/10 bg-[#091825] px-3 py-2"
                >
                  <div className="min-w-0 truncate">
                    <span className="font-mono-tabular text-[#2ad6ff]">{lm.cell}</span>
                    <span className="mx-1.5 text-[#e6edf3]/25">·</span>
                    <span>{lm.name}</span>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => onSetWaypoint({ x: lm.x, y: 0, z: lm.z, label: lm.name })}
                      className="flex min-h-[28px] cursor-pointer items-center gap-1 border border-[#e6edf3]/25 px-2.5 py-0.5 text-[11px] hover:border-[#2ad6ff]"
                    >
                      <MapPin size={11} />
                      <span>Pin</span>
                    </button>
                    {snap.creative && (
                      <button
                        onClick={() => onWarp(lm.x, lm.z)}
                        className="min-h-[28px] cursor-pointer border border-[#ff8a24]/60 bg-[#2a1810] px-2.5 py-0.5 text-[11px] text-[#f7d9c4] hover:border-[#ff8a24]"
                      >
                        Warp
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {snap.creative && (
                <button
                  onClick={() => {
                    const ctr = cellCenter(snap.cell);
                    onWarp(ctr.x, ctr.z);
                  }}
                  className="mt-2 w-full cursor-pointer border border-[#e6edf3]/15 py-1.5 text-[11px] text-[#8ea5b8] hover:text-white"
                >
                  Center on Current Sector ({snap.cell})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'databank' && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {DATABANK.map((entry) => {
            const count = snap.scanCounts[entry.id] ?? 0;
            const unlocked = snap.creative || count > 0;
            return (
              <div key={entry.id} className="border border-[#e6edf3]/12 bg-[#091825] p-3.5 text-xs">
                <div className="flex items-start justify-between gap-2 font-display font-semibold text-[#e6edf3]">
                  <span>{unlocked ? entry.name : 'Unscanned Specimen'}</span>
                  <span className="shrink-0 text-[11px] font-normal text-[#2ad6ff]">{entry.biome}</span>
                </div>
                <div className="mt-1.5 leading-relaxed text-[#9fb3c4]">
                  {unlocked ? entry.summary : 'Aim Scanner [F / Right-Click] at local flora, fauna, or Orrin relics to analyze.'}
                </div>
                {unlocked && entry.weakPoint && (
                  <div className="mt-2 border-t border-[#e6edf3]/8 pt-1.5 text-[11px] text-[#ffd166]">
                    Tactical Note: {entry.weakPoint}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PdaShell>
  );
};
