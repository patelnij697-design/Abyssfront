import React from 'react';

interface EndingModalProps {
  ending: 'quiet_tide' | 'last_light';
  onFreeRoam: () => void;
  onRestart: () => void;
}

export const EndingModal: React.FC<EndingModalProps> = ({ ending, onFreeRoam, onRestart }) => {
  const isQuiet = ending === 'quiet_tide';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030910]/94 p-6">
      <div className="relative w-full max-w-xl border border-[#2ad6ff]/35 bg-[#06111c] p-8 text-[#e6edf3] shadow-2xl">
        <span aria-hidden="true" className="pointer-events-none absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2 border-[#ff8a24]" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2 border-[#2ad6ff]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-[#2ad6ff]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-[#ff8a24]" />

        <div className="text-xs font-medium tracking-widest text-[#2ad6ff]">
          {isQuiet ? 'Ending A · Lattice Dormant' : 'Ending B · Core Overloaded'}
        </div>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-wider">
          {isQuiet ? 'QUIET TIDE' : 'LAST LIGHT'}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[#c7d6e2]">
          {isQuiet
            ? 'The Heartspire’s cyan seams soften to warm amber. The Lattice sleeps while Theta-9’s vents remain stable. Weeks later, a Terran Union light descends through the cloud—Captain Varga’s Echo whispers “thank you,” knowing the Union will claim the Core.'
            : 'The Core overloads and collapses into silence. The Tern Drop Ship carries you back to Landfall Cove as the sea turns red at dusk. The beacon is lost forever, and no one will ever take the Core.'}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            onClick={onFreeRoam}
            className="min-h-[42px] cursor-pointer border border-[#2ad6ff] bg-[#103449] px-5 py-2.5 font-display text-sm font-semibold text-white hover:bg-[#174b68]"
          >
            Continue in Free Roam
          </button>
          <button
            onClick={onRestart}
            className="min-h-[42px] cursor-pointer border border-[#e6edf3]/30 bg-[#0b1824] px-5 py-2.5 font-display text-sm font-semibold hover:border-white"
          >
            Dive Again
          </button>
        </div>
      </div>
    </div>
  );
};
