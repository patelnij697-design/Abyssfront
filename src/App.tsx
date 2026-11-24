import React, { useEffect, useRef, useState } from 'react';
import { AbyssfrontEngine } from './game/engine';
import { GameSnapshot } from './game/types';
import { MainMenu } from './components/MainMenu';
import { GameHUD } from './components/GameHUD';
import { StationModal } from './components/StationModal';
import { InventoryModal } from './components/InventoryModal';
import { DatabankModal } from './components/DatabankModal';
import { PuzzleModal } from './components/PuzzleModal';
import { TernModal } from './components/TernModal';
import { SaveSlotsModal } from './components/SaveSlotsModal';
import { EndingModal } from './components/EndingModal';

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AbyssfrontEngine | null>(null);
  const [snap, setSnap] = useState<GameSnapshot | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const engine = new AbyssfrontEngine(el, (nextSnap) => {
      setSnap(nextSnap);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const eng = engineRef.current;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#040a10]">
      {/* Isolated WebGL canvas mount */}
      <div ref={mountRef} className="fixed inset-0 h-full w-full" />

      {snap && !snap.started && (
        <MainMenu
          saveSlots={snap.saveSlots}
          onStart={(creative, slotId, skipIntro) => eng?.startNewGame(creative, slotId, skipIntro)}
          onContinue={(slotId) => eng?.loadSavedGame(slotId)}
          onDeleteSlot={(slotId) => eng?.deleteSaveSlot(slotId)}
        />
      )}

      {snap && snap.started && !snap.ending && (
        <GameHUD
          snap={snap}
          onSelectWeapon={(w) => eng?.selectWeapon(w)}
          onSelectTool={(t) => eng?.setTool(t)}
          onToggleHolster={() => eng?.toggleHolster()}
          onCycleSlot={(dir) => eng?.cycleSlot(dir)}
          onReload={() => eng?.triggerReload()}
          onOpenModal={(m) => eng?.openModal(m)}
          onInteract={() => eng?.interact()}
          onTogglePilot={() => eng?.togglePilot()}
          onToggleLights={() => eng?.toggleVehicleLights()}
          onVehicleBoost={() => eng?.activateVehicleBoost()}
          onRotateBuild={(deg) => eng?.rotateBuildGhost(deg)}
          onPlaceBuild={() => eng?.placeCurrentBuilding()}
          onCancelBuild={() => eng?.setBuildingMode(null)}
          onDeconstruct={() => eng?.deconstructTargetPiece()}
          onSkipIntro={() => eng?.skipIntro()}
          onFireChange={(active) => eng?.setFiring(active)}
          onScanChange={(active) => eng?.setScanning(active)}
          onTouchInput={(jx, jy, vert, fire, scan, sprint) => eng?.setTouchInput(jx, jy, vert, fire, scan, sprint)}
        />
      )}

      {snap?.activeModal?.type === 'station' && (
        <StationModal
          snap={snap}
          station={snap.activeModal.station}
          onCraft={(id) => eng?.craftRecipe(id)}
          onDecodeBlackBox={() => eng?.decodeBlackBox()}
          onRepairVehicle={(vid) => eng?.repairAndChargeVehicle(vid)}
          onSwitchStation={(s) => eng?.openModal({ type: 'station', station: s })}
          onClose={() => eng?.openModal(null)}
        />
      )}

      {snap?.activeModal?.type === 'inventory' && (
        <InventoryModal
          snap={snap}
          onUseConsumable={(id) => eng?.useConsumable(id)}
          onToggleHolster={() => eng?.toggleHolster()}
          onTransferToVehicle={(vid, item, qty) => eng?.transferCargoToVehicle(vid, item, qty)}
          onTransferFromVehicle={(vid, item, qty) => eng?.transferCargoFromVehicle(vid, item, qty)}
          onRepairVehicle={(vid) => eng?.repairAndChargeVehicle(vid)}
          onOpenModal={(m) => eng?.openModal(m)}
          onClose={() => eng?.openModal(null)}
        />
      )}

      {snap?.activeModal?.type === 'databank' && (
        <DatabankModal
          snap={snap}
          initialTab={snap.activeModal.tab}
          onSetWaypoint={(wp) => {
            eng?.setActiveWaypoint(wp);
            eng?.openModal(null);
          }}
          onWarp={(x, z) => eng?.warpTo(x, z)}
          onOpenModal={(m) => eng?.openModal(m)}
          onClose={() => eng?.openModal(null)}
        />
      )}

      {snap?.activeModal?.type === 'puzzle' && (
        <PuzzleModal
          puzzleId={snap.activeModal.puzzleId}
          onSolve={(id, payload) => eng?.solvePuzzle(id, payload)}
          onClose={() => eng?.openModal(null)}
        />
      )}

      {snap?.activeModal?.type === 'tern' && (
        <TernModal
          snap={snap}
          onActivate={(idx) => eng?.activateTernPower(idx)}
          onOpenModal={(m) => eng?.openModal(m)}
          onClose={() => eng?.openModal(null)}
        />
      )}

      {snap?.activeModal?.type === 'saves' && (
        <SaveSlotsModal
          snap={snap}
          onSaveToSlot={(slotId) => eng?.saveGame(slotId, true)}
          onLoadSlot={(slotId) => eng?.loadSavedGame(slotId)}
          onDeleteSlot={(slotId) => eng?.deleteSaveSlot(slotId)}
          onReturnToMenu={() => eng?.returnToMainMenu()}
          onOpenModal={(m) => eng?.openModal(m)}
          onClose={() => eng?.openModal(null)}
        />
      )}

      {snap?.ending && (
        <EndingModal
          ending={snap.ending}
          onFreeRoam={() => eng?.continueFreeRoam()}
          onRestart={() => window.location.reload()}
        />
      )}
    </div>
  );
}

export default App;
