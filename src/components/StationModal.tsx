import React, { useMemo, useState } from 'react';
import { Check, Cpu, Hammer, Layers, Lock, ShieldCheck, Wrench } from 'lucide-react';
import { GameSnapshot, ItemId, StationType } from '../game/types';
import { ITEMS, RECIPES } from '../game/data';
import { PdaShell } from './PdaShell';

interface StationModalProps {
  snap: GameSnapshot;
  station: StationType;
  onCraft: (recipeId: string) => void;
  onDecodeBlackBox: () => void;
  onRepairVehicle: (vehicleId: string) => void;
  onSwitchStation: (s: StationType) => void;
  onClose: () => void;
}

const STATION_TITLES: Record<StationType, string> = {
  standard: 'Standard Fabricator',
  workbench: 'Modification Station',
  vehicle_bay: 'Mobile Vehicle Bay',
  builder: 'Habitat Builder',
  alien: 'Orrin Alien Fabricator',
};

const STATION_SUBTITLES: Record<StationType, string> = {
  standard: 'Union survival synthesis · Materials, gear & rations',
  workbench: 'High-pressure depth, O₂ tank & weapon modifications',
  vehicle_bay: 'Submersible assembly, hull repair & power recharge',
  builder: 'Modular pressurized habitats, stations & power grids',
  alien: 'Lattice matter synthesis & black box decryption',
};

export const StationModal: React.FC<StationModalProps> = ({
  snap,
  station,
  onCraft,
  onDecodeBlackBox,
  onRepairVehicle,
  onSwitchStation,
  onClose,
}) => {
  const [catFilter, setCatFilter] = useState<string>('All');
  const list = useMemo(() => RECIPES.filter((r) => r.station === station), [station]);
  const categories = useMemo(() => {
    const cats = Array.from(new Set(list.map((r) => r.category)));
    return cats.length > 1 ? ['All', ...cats] : [];
  }, [list]);

  const activeFilter = categories.includes(catFilter) ? catFilter : 'All';
  const filtered = activeFilter === 'All' ? list : list.filter((r) => r.category === activeFilter);

  const hasIngredients = (ing: Partial<Record<ItemId, number>>) =>
    Object.entries(ing).every(([k, q]) => (snap.inventory[k as ItemId] ?? 0) >= (q ?? 0));

  const job = snap.craftingJob;
  const jobPct = job ? Math.min(100, Math.max(0, ((job.total - job.remaining) / Math.max(0.1, job.total)) * 100)) : 0;
  const jobItem = job ? ITEMS[job.output] : null;

  return (
    <PdaShell
      title={STATION_TITLES[station]}
      subtitle={`${STATION_SUBTITLES[station]} · Base Power ${Math.round(snap.basePower)}/${snap.basePowerCap} PU${
        station === 'alien' ? ` · Lattice Alert ${Math.round(snap.latticeAlert)}/50` : ''
      }${station === 'builder' ? ` · Modules Built ${snap.bases.length}` : ''}`}
      snap={snap}
      activeSection="station"
      onClose={onClose}
      maxWidthClass="max-w-4xl"
    >
      {/* Station Mode Selector Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-[#2ad6ff]/15 pb-3">
        {(['standard', 'workbench', 'vehicle_bay', 'alien', 'builder'] as StationType[]).map((st) => {
          const active = st === station;
          return (
            <button
              key={st}
              onClick={() => {
                setCatFilter('All');
                onSwitchStation(st);
              }}
              className={`flex min-h-[38px] cursor-pointer items-center gap-1.5 border px-3 py-1.5 font-display text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'border-[#2ad6ff] bg-[#103449] text-white'
                  : 'border-[#e6edf3]/15 bg-[#091724] text-[#8ea5b8] hover:border-[#2ad6ff]/45 hover:text-white'
              }`}
            >
              {st === 'builder' ? <Hammer size={13} /> : st === 'alien' ? <Cpu size={13} /> : <Layers size={13} />}
              <span>
                {st === 'standard'
                  ? 'Fabricator'
                  : st === 'workbench'
                  ? 'Mod Station'
                  : st === 'vehicle_bay'
                  ? 'Vehicle Bay'
                  : st === 'alien'
                  ? 'Orrin Tech'
                  : 'Habitat Builder'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dedicated Live Fabrication Synthesis Chamber Banner */}
      {job && (
        <div className="mb-5 flex flex-col gap-3 border border-[#ff8a24]/60 bg-[#0a1926] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="#06111c" stroke="rgba(255, 138, 36, 0.22)" strokeWidth="4" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#ff8a24"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 20}
                  strokeDashoffset={2 * Math.PI * 20 * (1 - jobPct / 100)}
                />
              </svg>
              <Wrench size={16} className="absolute text-[#2ad6ff]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#ff9f43]">Fabrication Beam Active</div>
              <div className="font-display truncate text-base font-bold text-white">
                {job.name}
                {job.outputQty > 1 ? ` ×${job.outputQty}` : ''}
              </div>
              <div className="truncate text-xs text-[#9fb3c4]">
                {jobItem?.description ?? 'Assembling molecular structure...'}
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 sm:w-52">
            <div className="flex justify-between font-mono-tabular text-xs">
              <span className="text-[#2ad6ff]">{Math.round(jobPct)}%</span>
              <span className="text-[#dce8f2]">{Math.max(0, job.remaining).toFixed(1)}s / {job.total.toFixed(1)}s</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden bg-[#132636]">
              <div
                className="h-full bg-gradient-to-r from-[#ff8a24] to-[#2ad6ff] transition-all duration-100"
                style={{ width: `${jobPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Black Box Decoder inside Orrin Alien Fabricator */}
      {station === 'alien' && !snap.flags.blackBoxDecoded && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-[#2ad6ff]/45 bg-[#081f2e] p-3.5 text-xs">
          <div>
            <div className="font-display text-sm font-semibold text-[#2ad6ff]">Pod 07 Black Box Decoder</div>
            <div className="mt-0.5 text-[#9fb3c4]">Extract Captain Varga’s Authority Code and final ship logs.</div>
          </div>
          <button
            onClick={onDecodeBlackBox}
            className="min-h-[38px] cursor-pointer border border-[#2ad6ff] bg-[#14435c] px-4 py-1.5 font-display text-xs font-semibold text-white hover:bg-[#1a5878] whitespace-nowrap"
          >
            Decode Black Box
          </button>
        </div>
      )}

      {/* Active Fleet Telemetry in Vehicle Bay */}
      {station === 'vehicle_bay' && snap.vehicles.length > 0 && (
        <div className="mb-5 border border-[#2ad6ff]/30 bg-[#081724] p-3.5">
          <div className="mb-2.5 flex items-center justify-between text-xs">
            <span className="font-display font-bold tracking-wider text-[#2ad6ff]">Active Fleet Status</span>
            <span className="font-mono-tabular text-[#9fb3c4]">{snap.vehicles.length} Deployed</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {snap.vehicles.map((v) => {
              const cargoUsed = Object.values(v.cargo).reduce((a, b) => a + (b ?? 0), 0);
              const needsService = v.hp < v.maxHp || v.power < v.maxPower;
              return (
                <div key={v.id} className="border border-[#e6edf3]/12 bg-[#0a1a28] p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-semibold text-[#e6edf3]">{v.name}</span>
                    <span className="font-mono-tabular text-[11px] text-[#2ad6ff]">Max {v.crushDepth}m</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 font-mono-tabular text-[11px] text-[#9fb3c4]">
                    <span>Hull {Math.round(v.hp)}/{v.maxHp}</span>
                    <span aria-hidden="true">·</span>
                    <span>Power {Math.round(v.power)}/{v.maxPower}</span>
                    <span aria-hidden="true">·</span>
                    <span>Cargo {cargoUsed}/{v.cargoCap}</span>
                  </div>
                  <div className="mt-2.5 flex justify-end">
                    <button
                      onClick={() => onRepairVehicle(v.id)}
                      disabled={!needsService}
                      className="min-h-[34px] cursor-pointer border border-[#4eff9f]/50 bg-[#0e2e1d] px-3 py-1 text-[11px] font-semibold text-[#8bffbe] hover:bg-[#14442b] disabled:cursor-default disabled:opacity-45"
                    >
                      {needsService ? 'Repair & Recharge' : '100% Ready'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter Segmented Controls */}
      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`min-h-[34px] cursor-pointer border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                activeFilter === cat
                  ? 'border-[#2ad6ff] bg-[#103449] text-white'
                  : 'border-[#e6edf3]/15 bg-[#091724] text-[#8ea5b8] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Recipe Blueprints Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {filtered.map((r) => {
          const unlocked = snap.creative || snap.unlockedIds.includes(r.unlockId);
          const affordable = snap.creative || hasIngredients(r.ingredients);
          const isThisCrafting = job?.recipeId === r.id;

          return (
            <button
              key={r.id}
              disabled={!unlocked || !affordable || !!job}
              onClick={() => onCraft(r.id)}
              className={`flex cursor-pointer flex-col justify-between border p-3.5 text-left transition-colors disabled:cursor-not-allowed ${
                isThisCrafting
                  ? 'border-[#ff8a24] bg-[#1c140c]'
                  : unlocked && affordable
                  ? 'border-[#2ad6ff]/30 bg-[#091825] hover:border-[#2ad6ff] hover:bg-[#0d2233]'
                  : 'border-[#e6edf3]/10 bg-[#07121c] opacity-55'
              }`}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {!unlocked ? (
                    <Lock size={14} className="shrink-0 text-[#8ea5b8]" />
                  ) : affordable ? (
                    <ShieldCheck size={14} className="shrink-0 text-[#2ad6ff]" />
                  ) : (
                    <Wrench size={14} className="shrink-0 text-[#8ea5b8]" />
                  )}
                  <span className="font-display truncate text-sm font-semibold text-[#e6edf3]">
                    {unlocked ? r.name : 'Locked Blueprint'}
                  </span>
                </div>
                <span className="font-mono-tabular shrink-0 text-[11px] text-[#2ad6ff]">
                  {isThisCrafting ? 'Fabricating...' : r.craftTime > 0 ? `${r.craftTime}s` : 'Build'}
                </span>
              </div>

              <div className="mt-1.5 text-xs text-[#9fb3c4]">{r.description}</div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[#e6edf3]/8 pt-2 font-mono-tabular text-[11px]">
                {Object.entries(r.ingredients).map(([k, reqQty]) => {
                  const have = snap.inventory[k as ItemId] ?? 0;
                  const need = reqQty ?? 0;
                  const ok = snap.creative || have >= need;
                  return (
                    <span key={k} className={`inline-flex items-center gap-1 ${ok ? 'text-[#7ae582]' : 'text-[#ff9f43]'}`}>
                      {ok && <Check size={11} />}
                      <span>
                        {ITEMS[k as ItemId]?.short ?? k}: {snap.creative ? need : `${have}/${need}`}
                      </span>
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </PdaShell>
  );
};
