import React from 'react';
import { Compass, Play, RotateCcw, Sparkles } from 'lucide-react';

interface MainMenuProps {
  hasSave: boolean;
  onStart: (creative: boolean) => void;
  onContinue: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ hasSave, onStart, onContinue }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#04111c]/88 via-[#030b14]/92 to-[#02060b]/96 p-4 sm:p-8">
      <div className="relative my-auto w-full max-w-3xl border border-[#2ad6ff]/30 bg-[#06111c]/95 p-6 shadow-2xl sm:p-10">
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

        <h1 className="font-display mt-2 text-4xl font-bold tracking-wider text-white sm:text-6xl" style={{ textWrap: 'balance' }}>
          ABYSSFRONT
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#a8bdce] sm:text-base">
          Specialist 3rd Class (Tag 07-D), sole survivor of the Union frigate Repuls. Dive into coral reefs,
          submerged caverns, volcanic highlands, and abyssal trenches—fabricate gear, construct pressurized habitats,
          and pilot submersibles into the Heartspire.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            onClick={() => onStart(false)}
            className="flex min-h-[46px] cursor-pointer items-center gap-2 border border-[#2ad6ff] bg-[#10384f] px-6 py-3 font-display text-sm font-semibold tracking-wider text-white transition-colors hover:bg-[#164e6e]"
          >
            <Play size={16} />
            <span>Start Survival Dive</span>
          </button>

          {hasSave && (
            <button
              onClick={onContinue}
              className="flex min-h-[46px] cursor-pointer items-center gap-2 border border-[#4eff9f]/60 bg-[#0d2b1d] px-6 py-3 font-display text-sm font-semibold tracking-wider text-[#d8ffea] transition-colors hover:bg-[#13402b]"
            >
              <RotateCcw size={16} />
              <span>Resume Saved Dive</span>
            </button>
          )}

          <button
            onClick={() => onStart(true)}
            className="flex min-h-[46px] cursor-pointer items-center gap-2 border border-[#ff8a24]/65 bg-[#29170b] px-6 py-3 font-display text-sm font-semibold tracking-wider text-[#ffe2c4] transition-colors hover:bg-[#3d2210]"
          >
            <Sparkles size={16} />
            <span>Creative Free-Build</span>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-[#2ad6ff]/15 pt-6 text-xs text-[#9fb3c4] sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-[#e6edf3]">
              <Compass size={15} className="text-[#2ad6ff]" />
              <span>Dive &amp; Controls</span>
            </div>
            <div>WASD or Analog Joystick · Look via Pointer-Lock or Drag</div>
            <div>Space — Ascend / Jump · C or Ctrl — Dive / Crouch</div>
            <div>Shift (or Full Stick) — Fast Swim · E — Gather / Enter / Board</div>
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
