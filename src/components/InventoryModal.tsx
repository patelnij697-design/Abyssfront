import React, { useState } from 'react';
import { Package, Shield, Wrench } from 'lucide-react';
import { ActiveModal, GameSnapshot, ItemId } from '../game/types';
import { ITEMS } from '../game/data';
import { PdaShell } from './PdaShell';

interface InventoryModalProps {
  snap: GameSnapshot;
  onUseConsumable: (id: ItemId) => void;
  onToggleHolster: () => void;
  onTransferToVehicle: (vehicleId: string, item: ItemId, qty: number) => void;
  onTransferFromVehicle: (vehicleId: string, item: ItemId, qty: number) => void;
  onRepairVehicle: (vehicleId: string) => void;
  onOpenModal?: (m: ActiveModal) => void;
  onClose: () => void;
}

const CONSUMABLE_IDS = new Set<ItemId>([
  'medkit',
  'ration_bar',
  'reef_fillet',
  'gourd',
  'bloomfruit',
  'hydro_gel',
  'hydro_cane',
]);

export const InventoryModal: React.FC<InventoryModalProps> = ({
  snap,
  onUseConsumable,
  onToggleHolster,
  onTransferToVehicle,
  onTransferFromVehicle,
  onRepairVehicle,
  onOpenModal,
  onClose,
}) => {
  const [selectedVehId, setSelectedVehId] = useState<string>(() => snap.piloting?.id ?? snap.vehicles[0]?.id ?? '');
  const activeVeh = snap.vehicles.find((v) => v.id === selectedVehId) ?? snap.piloting ?? snap.vehicles[0] ?? null;

  const entries = (Object.entries(snap.inventory) as Array<[ItemId, number]>).filter(([, qty]) => qty > 0);
  const cargoEntries = activeVeh
    ? (Object.entries(activeVeh.cargo) as Array<[ItemId, number]>).filter(([, qty]) => qty > 0)
    : [];
  const cargoUsed = cargoEntries.reduce((acc, [, q]) => acc + q, 0);

  return (
    <PdaShell
      title="Personal Equipment & Storage"
      subtitle={`Storage ${snap.usedSlots}/${snap.maxSlots} slots · ${
        snap.suitTier === 'reinforced' ? 'Reinforced Dive Suit (250m)' : 'Standard Dive Suit (90m)'
      } · O₂ Tank Mk${snap.tankTier} (${snap.o2Max}s)`}
      snap={snap}
      activeSection="inventory"
      onOpenModal={onOpenModal}
      onClose={onClose}
    >
      {/* Equipped Suit & Tools Strip */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#2ad6ff]/20 bg-[#081724] px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-display font-semibold text-[#2ad6ff]">
            <Shield size={14} />
            <span>Tools</span>
          </span>
          <span>Scanner</span>
          <span aria-hidden="true" className="text-[#e6edf3]/25">·</span>
          <span>Habitat Builder</span>
          <span aria-hidden="true" className="text-[#e6edf3]/25">·</span>
          <span className={snap.ownedTools.repair ? 'text-[#4eff9f]' : 'text-[#5b7083]'}>Repair Tool</span>
          <span aria-hidden="true" className="text-[#e6edf3]/25">·</span>
          <span className={snap.ownedTools.cutter ? 'text-[#ff9f43]' : 'text-[#5b7083]'}>Laser Cutter</span>
        </div>
        <button
          onClick={onToggleHolster}
          className="min-h-[34px] cursor-pointer border border-[#2ad6ff]/45 bg-[#103449] px-3 py-1 font-display text-xs font-semibold text-white hover:bg-[#174b68] whitespace-nowrap"
        >
          {snap.holstered ? 'Draw Weapon [X]' : 'Holster Weapon [X]'}
        </button>
      </div>

      {/* Vehicle Cargo Transfer Panel */}
      {activeVeh && (
        <div className="mb-5 border border-[#2ad6ff]/25 bg-[#081724] p-4 text-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#e6edf3]/10 pb-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1.5 font-display font-bold tracking-wide text-[#2ad6ff]">
                <Wrench size={14} />
                <span>Vehicle Hold</span>
              </span>
              {snap.vehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehId(v.id)}
                  className={`min-h-[32px] cursor-pointer border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                    v.id === activeVeh.id
                      ? 'border-[#2ad6ff] bg-[#103449] text-white'
                      : 'border-[#e6edf3]/15 bg-[#0b1b2a] text-[#8ea5b8] hover:text-white'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 font-mono-tabular">
              <span className="text-[#9fb3c4]">
                {cargoUsed}/{activeVeh.cargoCap} slots
              </span>
              <button
                onClick={() => onRepairVehicle(activeVeh.id)}
                disabled={activeVeh.hp >= activeVeh.maxHp && activeVeh.power >= activeVeh.maxPower}
                className="min-h-[32px] cursor-pointer border border-[#4eff9f]/50 bg-[#0e2e1d] px-2.5 py-1 text-[11px] font-semibold text-[#8bffbe] hover:bg-[#14442b] disabled:opacity-40"
              >
                Service Craft
              </button>
            </div>
          </div>

          {cargoEntries.length === 0 ? (
            <div className="py-2 text-xs text-[#8ea5b8]">
              Cargo bay is empty. Select &ldquo;Store&rdquo; on any inventory item below to load {activeVeh.name}.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cargoEntries.map(([id, qty]) => (
                <div key={id} className="flex items-center justify-between border border-[#e6edf3]/10 bg-[#0a1a28] px-3 py-2">
                  <span className="truncate font-medium text-[#e6edf3]">{ITEMS[id]?.name ?? id}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono-tabular text-[#4eff9f]">×{qty}</span>
                    <button
                      onClick={() => onTransferFromVehicle(activeVeh.id, id, 1)}
                      className="min-h-[30px] cursor-pointer border border-[#2ad6ff]/50 bg-[#103449] px-2.5 py-0.5 text-[11px] text-white hover:bg-[#174b68]"
                    >
                      Take 1
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Backpack Inventory Section */}
      <div className="mb-2 flex items-center justify-between text-xs text-[#8ea5b8]">
        <span className="inline-flex items-center gap-1.5 font-display font-semibold text-[#dce8f2]">
          <Package size={14} className="text-[#ff8a24]" />
          <span>Backpack Contents</span>
        </span>
        <span className="font-mono-tabular">
          {snap.usedSlots} / {snap.maxSlots} capacity used
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="border border-[#e6edf3]/10 bg-[#081724] py-12 text-center text-sm text-[#8ea5b8]">
          Your pack is empty. Dive into Landfall Cove and gather Titanium Ore or Silicate Deposits.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {entries.map(([id, qty]) => {
            const def = ITEMS[id];
            const isCons = CONSUMABLE_IDS.has(id);
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-2 border border-[#e6edf3]/12 bg-[#091825] px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#e6edf3]">{def?.name ?? id}</div>
                  <div className="truncate text-[11px] text-[#8ea5b8]">{def?.description}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="font-mono-tabular mr-1 font-semibold text-[#2ad6ff]">×{qty}</span>
                  {activeVeh && (
                    <button
                      onClick={() => onTransferToVehicle(activeVeh.id, id, 1)}
                      disabled={cargoUsed >= activeVeh.cargoCap}
                      className="min-h-[32px] cursor-pointer border border-[#e6edf3]/25 bg-[#0e1f2e] px-2.5 py-1 text-[11px] hover:border-[#2ad6ff] disabled:opacity-35"
                    >
                      Store
                    </button>
                  )}
                  {isCons && (
                    <button
                      onClick={() => onUseConsumable(id)}
                      className="min-h-[32px] cursor-pointer border border-[#2ad6ff]/60 bg-[#103449] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#174b68]"
                    >
                      Use
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PdaShell>
  );
};
