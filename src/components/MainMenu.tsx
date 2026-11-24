import React, { useState } from 'react';
import { Compass, Play, RotateCcw, Shield, Sparkles, Trash2 } from 'lucide-react';
import { SaveSlotMeta } from '../game/types';

interface MainMenuProps {
  saveSlots: SaveSlotMeta[];
  onStart: (creative: boolean, slotId: 1 | 2 | 3, skipIntro: boolean) => void;
  onContinue: (slotId: 1 | 2 | 3) => void;
  onDeleteSlot: (slotId: 1 | 2 | 3) => void;
}

function formatSavedTime(ts: number): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const MainMenu: React.FC<MainMenuProps> = ({
  saveSlots,
  onStart,
  onContinue,
  onDeleteSlot,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<1 | 2 | 3>(() => {
    const firstUsed = saveSlots.find((s) => !s.empty);
    return firstUsed ? firstUsed.slotId : 1;
  });
  const [playIntro, setPlayIntro] = useState(true);

  const activeSlot = saveSlots.find((s) => s.slotId === selectedSlot) ?? saveSlots[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#04111c]/88 via-[#030b14]/92 to-[#02060b]/96 p-4 sm:p-8">
      <div className="relative my-auto w-full max-w-4xl border border-[#2ad6ff]/30 bg-[#06111c]/95 p-6 shadow-2xl sm:p-9">
        {/* Subnautica-inspired corner markers */}
        <span aria-hidden="true" className="pointer-events-none absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2 border-[#ff8a24]" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2 border-[#2ad6ff]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-[#2ad6ff]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-[#ff8a24]" />

        <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-widest text-[#2ad6ff]">
          <span>Planet Theta-9</span>
          <span aria-hidden="true" className="text-[#e6edf3]/30">·</span>
          <span className="text-[#ff9f43]">TFR-419 Repuls Lifepod 07</span>
        </div>

        <h1 className="font-display mt-2 text-4xl font-bold tracking-wider text-white sm:text-5xl" style={{ textWrap: 'balance' }}>
          ABYSSFRONT
        </h1>

        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[#a8bdce]">
          Specialist 3rd Class (Tag 07-D), sole survivor of the Union frigate Repuls. Evacuate the crashing
          frigate, dive into coral reefs, submerged caverns, and abyssal trenches, construct pressurized habitats,
          and pilot submersibles into the Heartspire.
        </p>

        {/* 3 Save Slots Grid */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wider text-[#8ea5b8]">
            <span>SELECT EXPEDITION SAVE SLOT</span>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-[#b8cad8]">
              <input
                type="checkbox"
                checked={playIntro}
                onChange={(e) => setPlayIntro(e.target.checked)}
                className="accent-[#ff8a24]"
              />
              <span>Play Repuls Crash Intro (Survival)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {saveSlots.map((slot) => {
              const selected = slot.slotId === selectedSlot;
              return (
                <div
                  key={slot.slotId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSlot(slot.slotId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSlot(slot.slotId);
                    }
                  }}
                  className={`flex cursor-pointer flex-col justify-between border p-3.5 text-left transition-colors ${
                    selected
                      ? 'border-[#2ad6ff] bg-[#0c2336]'
                      : 'border-[#2ad6ff]/20 bg-[#071420] hover:border-[#2ad6ff]/55'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-xs font-bold tracking-wider text-white">
                        SLOT {slot.slotId}
                      </span>
                      {slot.empty ? (
                        <span className="border border-[#e6edf3]/20 bg-[#0d1c29] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#8ea5b8]">
                          EMPTY
                        </span>
                      ) : slot.creative ? (
                        <span className="flex items-center gap-1 border border-[#ff8a24]/65 bg-[#2c190a] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#ffbe82]">
                          <Sparkles size={10} />
                          CREATIVE
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 border border-[#2ad6ff]/65 bg-[#0b2a3c] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#8ce0ff]">
                          <Shield size={10} />
                          SURVIVAL
                        </span>
                      )}
                    </div>

                    {slot.empty ? (
                      <div className="mt-3 text-xs text-[#7e95a8]">Empty slot ready for a new dive.</div>
                    ) : (
                      <div className="mt-2.5 space-y-0.5 text-xs">
                        <div className="truncate font-semibold text-white">{slot.missionTitle}</div>
                        <div className="font-mono-tabular text-[11px] text-[#9fb3c4]">
                          {slot.cell} · {slot.biomeName} ({slot.depth}m)
                        </div>
                        <div className="font-mono-tabular text-[10px] text-[#738a9e]">
                          {slot.basesCount} bases · {slot.vehiclesCount} vehicles
                        </div>
                        {slot.savedAt > 0 && (
                          <div className="font-mono-tabular text-[10px] text-[#667d92]">
                            {formatSavedTime(slot.savedAt)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!slot.empty && (
                    <div className="mt-3 flex items-center gap-1.5 border-t border-[#2ad6ff]/15 pt-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onContinue(slot.slotId);
                        }}
                        className="flex min-h-[36px] flex-1 cursor-pointer items-center justify-center gap-1.5 border border-[#4eff9f]/60 bg-[#0d2b1d] px-2.5 py-1 font-display text-xs font-semibold text-[#d8ffea] hover:bg-[#13402b] whitespace-nowrap"
                      >
                        <RotateCcw size={13} />
                        <span>Resume {slot.creative ? 'Creative' : 'Survival'}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSlot(slot.slotId);
                        }}
                        title={`Delete Slot ${slot.slotId}`}
                        className="flex min-h-[36px] cursor-pointer items-center justify-center border border-[#ef4444]/45 bg-[#2a0c0c] px-2.5 py-1 text-[#ffb4b4] hover:border-[#ef4444]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {activeSlot && !activeSlot.empty && (
            <button
              onClick={() => onContinue(activeSlot.slotId)}
              className="flex min-h-[46px] cursor-pointer items-center gap-2 border border-[#4eff9f]/70 bg-[#0d2b1d] px-5 py-3 font-display text-sm font-semibold tracking-wider text-[#d8ffea] transition-colors hover:bg-[#13402b] whitespace-nowrap"
            >
              <RotateCcw size={16} />
              <span>
                Resume Slot {activeSlot.slotId} ({activeSlot.creative ? 'Creative' : 'Survival'})
              </span>
            </button>
          )}

          <button
            onClick={() => onStart(false, selectedSlot, !playIntro)}
            className="flex min-h-[46px] cursor-pointer items-center gap-2 border border-[#2ad6ff] bg-[#10384f] px-5 py-3 font-display text-sm font-semibold tracking-wider text-white transition-colors hover:bg-[#164e6e] whitespace-nowrap"
          >
            <Play size={16} />
            <span>
              {activeSlot?.empty ? `New Survival Dive (Slot ${selectedSlot})` : `Overwrite Survival (Slot ${selectedSlot})`}
            </span>
          </button>

          <button
            onClick={() => onStart(true, selectedSlot, true)}
            className="flex min-h-[46px] cursor-pointer items-center gap-2 border border-[#ff8a24]/65 bg-[#29170b] px-5 py-3 font-display text-sm font-semibold tracking-wider text-[#ffe2c4] transition-colors hover:bg-[#3d2210] whitespace-nowrap"
          >
            <Sparkles size={16} />
            <span>
              {activeSlot?.empty ? `New Creative Dive (Slot ${selectedSlot})` : `Overwrite Creative (Slot ${selectedSlot})`}
            </span>
          </button>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-6 border-t border-[#2ad6ff]/15 pt-5 text-xs text-[#9fb3c4] sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-[#e6edf3]">
              <Compass size={15} className="text-[#2ad6ff]" />
              <span>Dive &amp; Controls</span>
            </div>
            <div>WASD or Analog Joystick · Look via Pointer-Lock or Drag</div>
            <div>Space — Ascend / Jump · C or Ctrl — Dive / Crouch</div>
            <div>Shift (or Full Stick) — Fast Swim / Boost · E — Gather / Board</div>
            <div>Q / R (while building) — Rotate · G — Deconstruct Habitat</div>
          </div>

          <div className="space-y-1.5">
            <div className="font-display text-sm font-semibold text-[#e6edf3]">PDA, Tools &amp; Submersibles</div>
            <div>1–7 or Mouse Wheel — Weapons, Scanner, Repair, Cutter, Builder</div>
            <div>Right-Click / F / Scan — Analyze Wildlife &amp; Blueprints</div>
            <div>Tab — PDA Missions, Sonar Map &amp; Logs · I — Equipment &amp; Cargo</div>
            <div>B — Habitat Builder · V — Enter / Exit Vehicle · L — Headlights</div>
          </div>
        </div>
      </div>
    </div>
  );
};
