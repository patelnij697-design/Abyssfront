import React, { useState } from 'react';
import { PdaShell } from './PdaShell';

interface PuzzleModalProps {
  puzzleId: 'aux_power' | 'coolant_loop' | 'glyph_door' | 'core_terminal';
  onSolve: (puzzleId: 'aux_power' | 'coolant_loop' | 'glyph_door' | 'core_terminal', payload?: string) => void;
  onClose: () => void;
}

export const PuzzleModal: React.FC<PuzzleModalProps> = ({ puzzleId, onSolve, onClose }) => {
  const [conduits, setConduits] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [valveSeq, setValveSeq] = useState<string[]>([]);
  const [glyphs, setGlyphs] = useState<[string, string, string]>(['Circle', 'Circle', 'Circle']);

  const title =
    puzzleId === 'aux_power'
      ? 'Hangar Auxiliary Power Junction'
      : puzzleId === 'coolant_loop'
      ? 'Reactor Coolant Loop Valves'
      : puzzleId === 'glyph_door'
      ? 'Waystation Alpha — Orrin Glyph Seal'
      : 'Heartspire Core Terminal';

  return (
    <PdaShell title={title} onClose={onClose} maxWidthClass="max-w-lg">
      {puzzleId === 'aux_power' && (
        <div className="space-y-3 text-xs">
          <p className="text-[#9fb3c4]">
            Bridge all three burnt conduits (Red, Blue, Amber) to their matching sockets using the Repair Tool and 2 Copper Wire.
          </p>
          {(['Red Conduit', 'Blue Conduit', 'Amber Conduit'] as const).map((lbl, idx) => (
            <div key={lbl} className="flex items-center justify-between border border-[#e6edf3]/12 bg-[#091825] px-3.5 py-2.5">
              <span className="font-medium">{lbl}</span>
              <button
                onClick={() => {
                  const next: [boolean, boolean, boolean] = [...conduits] as [boolean, boolean, boolean];
                  next[idx] = true;
                  setConduits(next);
                }}
                className={`min-h-[34px] cursor-pointer border px-3 py-1 font-medium ${
                  conduits[idx] ? 'border-[#4eff9f] bg-[#0e2e1d] text-[#8bffbe]' : 'border-[#2ad6ff] bg-[#103449] text-white'
                }`}
              >
                {conduits[idx] ? 'Bridged' : 'Wire & Repair'}
              </button>
            </div>
          ))}
          <button
            disabled={!conduits.every(Boolean)}
            onClick={() => onSolve('aux_power')}
            className="mt-2 min-h-[42px] w-full cursor-pointer border border-[#2ad6ff] bg-[#103449] py-2 font-display text-sm font-semibold text-white hover:bg-[#174b68] disabled:opacity-40"
          >
            Restore Auxiliary Power
          </button>
        </div>
      )}

      {puzzleId === 'coolant_loop' && (
        <div className="space-y-3 text-xs">
          <p className="text-[#9fb3c4]">
            Chief Engineer Menon’s log: “Bypass first, always. Primary second. Return last. Then pray.”
          </p>
          <div className="font-mono-tabular text-[#ffd166]">
            Current sequence: {valveSeq.length ? valveSeq.join(' -> ') : 'None'}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['A (Primary)', 'B (Bypass)', 'C (Return)'] as const).map((v) => {
              const code = v[0];
              return (
                <button
                  key={v}
                  disabled={valveSeq.includes(code)}
                  onClick={() => {
                    const next = [...valveSeq, code];
                    if (next.length === 3) {
                      if (next.join('') === 'BAC') onSolve('coolant_loop', 'ok');
                      else {
                        setValveSeq([]);
                        onSolve('coolant_loop', 'fail');
                      }
                    } else {
                      setValveSeq(next);
                    }
                  }}
                  className="min-h-[44px] cursor-pointer border border-[#ff8a24]/60 bg-[#24150d] py-3 font-semibold text-[#ffe2c2] hover:bg-[#3a2013] disabled:opacity-40"
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {puzzleId === 'glyph_door' && (
        <div className="space-y-3 text-xs">
          <p className="text-[#9fb3c4]">
            Orrin Mural I depicts the tide cycle in order: Spiral, Ring, Spiral-in-Ring.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {glyphs.map((g, idx) => {
              const opts = ['Spiral', 'Ring', 'Spiral-in-Ring'];
              return (
                <button
                  key={idx}
                  onClick={() => {
                    const next: [string, string, string] = [...glyphs] as [string, string, string];
                    next[idx] = opts[(opts.indexOf(g) + 1) % opts.length];
                    setGlyphs(next);
                  }}
                  className="cursor-pointer border border-[#2ad6ff]/45 bg-[#091825] py-4 text-center font-semibold hover:border-[#2ad6ff]"
                >
                  Slot {idx + 1}
                  <div className="mt-1 text-[#2ad6ff]">{g}</div>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => {
              if (glyphs[0] === 'Spiral' && glyphs[1] === 'Ring' && glyphs[2] === 'Spiral-in-Ring') {
                onSolve('glyph_door', 'ok');
              } else {
                onSolve('glyph_door', 'fail');
              }
            }}
            className="min-h-[42px] w-full cursor-pointer border border-[#2ad6ff] bg-[#103449] py-2 font-display text-sm font-semibold text-white hover:bg-[#174b68]"
          >
            Engage Orrin Seal
          </button>
        </div>
      )}

      {puzzleId === 'core_terminal' && (
        <div className="space-y-4 text-xs">
          <p className="leading-relaxed text-[#dce6ef]">
            Captain Varga’s Authority Code is accepted. The Lattice Core hums open before you.
            Disabling it puts the defense mesh to sleep while preserving Theta-9’s climate—allowing a Union ship to answer your beacon and seize the Core.
            Destroying it overloads the Core forever, sacrificing the beacon.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              onClick={() => onSolve('core_terminal', 'disable')}
              className="cursor-pointer border border-[#2ad6ff] bg-[#0f3447] p-3.5 text-left hover:bg-[#164b66]"
            >
              <div className="font-display text-sm font-bold text-[#2ad6ff]">Disable the Lattice</div>
              <div className="mt-1 text-[11px] text-[#c7d6e2]">Ending A: Quiet Tide. Rescue arrives, Union claims the Core.</div>
            </button>
            <button
              onClick={() => onSolve('core_terminal', 'destroy')}
              className="cursor-pointer border border-[#ef4444] bg-[#3b1212] p-3.5 text-left hover:bg-[#521818]"
            >
              <div className="font-display text-sm font-bold text-[#ff8b8b]">Destroy the Lattice</div>
              <div className="mt-1 text-[11px] text-[#f2c9c9]">Ending B: Last Light. Overload the Core; no one will ever take it.</div>
            </button>
          </div>
        </div>
      )}
    </PdaShell>
  );
};
