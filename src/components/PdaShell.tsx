import React from 'react';
import {
  Backpack,
  BookOpen,
  Compass,
  FileText,
  Hammer,
  Map as MapIcon,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { ActiveModal, GameSnapshot } from '../game/types';

export type PdaSectionKey =
  | 'inventory'
  | 'missions'
  | 'logs'
  | 'map'
  | 'databank'
  | 'tern'
  | 'station';

interface PdaShellProps {
  title: string;
  subtitle?: string;
  snap?: GameSnapshot;
  activeSection?: PdaSectionKey;
  onOpenModal?: (m: ActiveModal) => void;
  onClose: () => void;
  maxWidthClass?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export const PdaShell: React.FC<PdaShellProps> = ({
  title,
  subtitle,
  snap,
  activeSection,
  onOpenModal,
  onClose,
  maxWidthClass = 'max-w-4xl',
  headerRight,
  children,
}) => {
  const navItems: Array<{
    key: PdaSectionKey;
    label: string;
    icon: React.ReactNode;
    modal: ActiveModal;
  }> = [
    { key: 'inventory', label: 'Inventory', icon: <Backpack size={14} />, modal: { type: 'inventory' } },
    { key: 'missions', label: 'Missions', icon: <Compass size={14} />, modal: { type: 'databank', tab: 'missions' } },
    { key: 'map', label: 'Sonar Map', icon: <MapIcon size={14} />, modal: { type: 'databank', tab: 'map' } },
    { key: 'logs', label: 'Voice Logs', icon: <FileText size={14} />, modal: { type: 'databank', tab: 'logs' } },
    { key: 'databank', label: 'Databank', icon: <BookOpen size={14} />, modal: { type: 'databank', tab: 'databank' } },
    { key: 'tern', label: 'Tern Dropship', icon: <Zap size={14} />, modal: { type: 'tern' } },
  ];

  const showPdaNav = Boolean(onOpenModal && activeSection && activeSection !== 'station');

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#02070d]/82 p-2 sm:p-5"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative flex max-h-[92vh] w-full ${maxWidthClass} flex-col border border-[#2ad6ff]/35 bg-[#06111c] text-[#e6edf3] shadow-2xl`}
      >
        {/* Subtle Subnautica PDA corner brackets */}
        <span aria-hidden="true" className="pointer-events-none absolute -top-px -left-px h-3.5 w-3.5 border-t-2 border-l-2 border-[#ff8a24]" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-px -right-px h-3.5 w-3.5 border-t-2 border-r-2 border-[#2ad6ff]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-px -left-px h-3.5 w-3.5 border-b-2 border-l-2 border-[#2ad6ff]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-px -right-px h-3.5 w-3.5 border-b-2 border-r-2 border-[#ff8a24]" />

        {/* Top PDA Header Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2ad6ff]/20 bg-[#040c15] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rotate-45 bg-[#ff8a24]" aria-hidden="true" />
              <h2 className="font-display truncate text-base font-bold tracking-wider text-[#e6edf3] sm:text-lg">
                {title}
              </h2>
            </div>
            {subtitle && (
              <div className="font-mono-tabular mt-0.5 truncate text-xs text-[#8ea5b8]">
                {subtitle}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {snap && (
              <div className="hidden items-center gap-2 text-xs text-[#8ea5b8] md:flex">
                <span className="font-mono-tabular">O₂ {Math.round(snap.o2)}/{snap.o2Max}s</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">HP {Math.round(snap.hp)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">Depth {Math.round(snap.depth)}m</span>
              </div>
            )}
            {headerRight}
            <button
              onClick={onClose}
              aria-label="Close PDA"
              className="flex min-h-[38px] shrink-0 cursor-pointer items-center gap-1.5 border border-[#e6edf3]/25 bg-[#0a1927] px-3 py-1.5 text-xs font-medium text-[#dce8f2] transition-colors hover:border-[#ff8a24] hover:text-white whitespace-nowrap"
            >
              <X size={14} />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Subnautica PDA Top Tab Strip */}
        {showPdaNav && onOpenModal && (
          <div className="flex items-center gap-1 overflow-x-auto border-b border-[#2ad6ff]/15 bg-[#050f19] px-3 py-2 sm:px-6">
            {navItems.map((item) => {
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onOpenModal(item.modal)}
                  className={`flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 border px-3 py-1.5 font-display text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${
                    active
                      ? 'border-[#2ad6ff] bg-[#103247] text-[#ffffff]'
                      : 'border-transparent bg-transparent text-[#8ea5b8] hover:border-[#2ad6ff]/30 hover:bg-[#0a1a28] hover:text-[#e6edf3]'
                  }`}
                >
                  <span className={active ? 'text-[#2ad6ff]' : 'text-[#6e879c]'}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => onOpenModal({ type: 'station', station: 'builder' })}
              className="ml-auto flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 border border-[#ff8a24]/35 bg-[#1b120a] px-3 py-1.5 font-display text-xs font-semibold text-[#ffbe82] transition-colors hover:border-[#ff8a24] whitespace-nowrap"
            >
              <Hammer size={13} />
              <span>Habitat Builder</span>
            </button>
          </div>
        )}

        {/* Active Fabrication Banner inside any PDA screen if fabricating */}
        {snap?.craftingJob && (
          <div className="border-b border-[#ff8a24]/35 bg-[#0b1925] px-4 py-2.5 sm:px-6">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-[#ffe2c2]">
                <Wrench size={14} className="shrink-0 text-[#ff8a24]" />
                <span>
                  Fabricating <strong className="font-display text-white">{snap.craftingJob.name}</strong>
                  {snap.craftingJob.outputQty > 1 ? ` ×${snap.craftingJob.outputQty}` : ''}
                </span>
              </div>
              <div className="font-mono-tabular shrink-0 text-[#2ad6ff]">
                {Math.max(0, snap.craftingJob.remaining).toFixed(1)}s remaining ·{' '}
                {Math.round(
                  ((snap.craftingJob.total - snap.craftingJob.remaining) / Math.max(0.1, snap.craftingJob.total)) * 100
                )}
                %
              </div>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden bg-[#132636]">
              <div
                className="h-full bg-gradient-to-r from-[#ff8a24] to-[#2ad6ff] transition-all duration-100"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      ((snap.craftingJob.total - snap.craftingJob.remaining) / Math.max(0.1, snap.craftingJob.total)) * 100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Main Scrollable PDA Body */}
        <div className="overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
};
