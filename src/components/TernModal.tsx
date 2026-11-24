import React from 'react';
import { Shield, Target, PackagePlus } from 'lucide-react';
import { ActiveModal, GameSnapshot } from '../game/types';
import { PdaShell } from './PdaShell';

interface TernModalProps {
  snap: GameSnapshot;
  onActivate: (idx: 0 | 1 | 2) => void;
  onOpenModal?: (m: ActiveModal) => void;
  onClose: () => void;
}

export const TernModal: React.FC<TernModalProps> = ({ snap, onActivate, onOpenModal, onClose }) => {
  const powers: Array<{ idx: 0 | 1 | 2; title: string; desc: string; cd: number; icon: React.ReactNode }> = [
    {
      idx: 0,
      title: 'Aegis Dome',
      desc: 'Projects a 25m defensive barrier absorbing up to 600 damage for 30s.',
      cd: snap.ternCooldowns[0],
      icon: <Shield size={18} className="text-[#2ad6ff]" />,
    },
    {
      idx: 1,
      title: 'Overwatch Autocannons',
      desc: 'Engages automated 40 DPS targeting against nearby threats within 60m for 25s.',
      cd: snap.ternCooldowns[1],
      icon: <Target size={18} className="text-[#ff8a24]" />,
    },
    {
      idx: 2,
      title: 'Resupply Drop',
      desc: 'Airdrops 2 Plasma Cell Packs, 1 Medkit, and 1 Ration Bar directly to your pack.',
      cd: snap.ternCooldowns[2],
      icon: <PackagePlus size={18} className="text-[#4eff9f]" />,
    },
  ];

  const statusText = snap.ternRestored
    ? snap.ternPadBuilt
      ? 'Orbit Ready (Surface / Land ≤ 10m)'
      : 'Requires Tern Landing Pad'
    : 'Wrecked in Repuls Lower Hangar';

  return (
    <PdaShell
      title="Tern VTOL Support Link"
      subtitle={`Charges ${snap.ternCharges}/3 · ${statusText}`}
      snap={snap}
      activeSection="tern"
      onOpenModal={onOpenModal}
      onClose={onClose}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-2.5 text-xs">
        {powers.map((p) => (
          <button
            key={p.idx}
            disabled={(!snap.ternRestored || !snap.ternPadBuilt || p.cd > 0) && !snap.creative}
            onClick={() => onActivate(p.idx)}
            className="flex w-full cursor-pointer items-center justify-between gap-4 border border-[#2ad6ff]/25 bg-[#091825] p-3.5 text-left transition-colors hover:border-[#2ad6ff] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{p.icon}</div>
              <div>
                <div className="font-display text-sm font-semibold text-[#e6edf3]">{p.title}</div>
                <div className="mt-0.5 leading-relaxed text-[#9fb3c4]">{p.desc}</div>
              </div>
            </div>
            <span className="font-mono-tabular shrink-0 border border-[#2ad6ff]/40 bg-[#103449] px-3 py-1.5 text-xs font-semibold text-white">
              {p.cd > 0 ? `${Math.ceil(p.cd)}s` : 'Deploy'}
            </span>
          </button>
        ))}
      </div>
    </PdaShell>
  );
};
