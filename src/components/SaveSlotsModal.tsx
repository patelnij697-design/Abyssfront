import React from 'react';
import { FolderDown, Home, Save, Shield, Sparkles, Trash2 } from 'lucide-react';
import { ActiveModal, GameSnapshot } from '../game/types';
import { PdaShell } from './PdaShell';

interface SaveSlotsModalProps {
  snap: GameSnapshot;
  onSaveToSlot: (slotId: 1 | 2 | 3) => void;
  onLoadSlot: (slotId: 1 | 2 | 3) => void;
  onDeleteSlot: (slotId: 1 | 2 | 3) => void;
  onReturnToMenu: () => void;
  onOpenModal: (m: ActiveModal) => void;
  onClose: () => void;
}

function formatSavedTime(ts: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Saved';
  }
}

export const SaveSlotsModal: React.FC<SaveSlotsModalProps> = ({
  snap,
  onSaveToSlot,
  onLoadSlot,
  onDeleteSlot,
  onReturnToMenu,
  onOpenModal,
  onClose,
}) => {
  return (
    <PdaShell
      title="EXPEDITION LOGS & SAVE SLOTS"
      subtitle={`Current Session: Slot ${snap.activeSaveSlot} · ${snap.creative ? 'CREATIVE MODE' : 'SURVIVAL MODE'}`}
      snap={snap}
      activeSection="saves"
      onOpenModal={onOpenModal}
      onClose={onClose}
      headerRight={
        <button
          onClick={onReturnToMenu}
          className="flex min-h-[38px] shrink-0 cursor-pointer items-center gap-1.5 border border-[#ff8a24]/55 bg-[#29170b] px-3 py-1.5 text-xs font-semibold text-[#ffe2c4] transition-colors hover:border-[#ff8a24] whitespace-nowrap"
        >
          <Home size={14} />
          <span>Main Menu</span>
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-[#9fb3c4]">
          Store up to three independent expeditions. Each slot records whether the dive is{' '}
          <span className="font-semibold text-[#2ad6ff]">SURVIVAL</span> or{' '}
          <span className="font-semibold text-[#ff9f43]">CREATIVE</span>, along with sector, depth, habitats, and fleet telemetry.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {snap.saveSlots.map((slot) => {
            const isActive = snap.activeSaveSlot === slot.slotId;
            return (
              <div
                key={slot.slotId}
                className={`flex flex-col justify-between border p-4 ${
                  isActive ? 'border-[#2ad6ff] bg-[#0a1d2d]' : 'border-[#2ad6ff]/25 bg-[#071420]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold tracking-wider text-white">
                      SLOT {slot.slotId}
                    </span>
                    {slot.empty ? (
                      <span className="border border-[#e6edf3]/20 bg-[#0d1c29] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#8ea5b8]">
                        EMPTY
                      </span>
                    ) : slot.creative ? (
                      <span className="flex items-center gap-1 border border-[#ff8a24]/60 bg-[#2c190a] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#ffbe82]">
                        <Sparkles size={11} />
                        CREATIVE
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 border border-[#2ad6ff]/60 bg-[#0b2a3c] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#8ce0ff]">
                        <Shield size={11} />
                        SURVIVAL
                      </span>
                    )}
                  </div>

                  {slot.empty ? (
                    <div className="mt-4 text-xs text-[#7e95a8]">
                      No dive telemetry recorded in this slot.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-1 text-xs text-[#b8cad8]">
                      <div className="font-semibold text-white">{slot.missionTitle}</div>
                      <div className="font-mono-tabular text-[11px] text-[#8ea5b8]">
                        Sector {slot.cell} · {slot.biomeName} · {slot.depth}m
                      </div>
                      <div className="font-mono-tabular text-[11px] text-[#8ea5b8]">
                        Habitats: {slot.basesCount} · Vehicles: {slot.vehiclesCount}
                      </div>
                      <div className="font-mono-tabular text-[10px] text-[#6d8599]">
                        Saved {formatSavedTime(slot.savedAt)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#2ad6ff]/15 pt-3">
                  <button
                    onClick={() => onSaveToSlot(slot.slotId)}
                    className="flex min-h-[38px] flex-1 cursor-pointer items-center justify-center gap-1.5 border border-[#2ad6ff]/70 bg-[#10384f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#174f6e] whitespace-nowrap"
                  >
                    <Save size={13} />
                    <span>{slot.empty ? 'Save Here' : 'Overwrite'}</span>
                  </button>

                  {!slot.empty && (
                    <>
                      <button
                        onClick={() => onLoadSlot(slot.slotId)}
                        className="flex min-h-[38px] cursor-pointer items-center justify-center gap-1 border border-[#4eff9f]/60 bg-[#0e2d1e] px-3 py-1.5 text-xs font-semibold text-[#d8ffea] hover:bg-[#14422c] whitespace-nowrap"
                      >
                        <FolderDown size={13} />
                        <span>Load</span>
                      </button>
                      <button
                        onClick={() => onDeleteSlot(slot.slotId)}
                        title={`Delete Slot ${slot.slotId}`}
                        className="flex min-h-[38px] cursor-pointer items-center justify-center border border-[#ef4444]/50 bg-[#2d0c0c] px-2.5 py-1.5 text-xs text-[#ffb4b4] hover:border-[#ef4444]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PdaShell>
  );
};
