"use client";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { KioskDevice } from "@/lib/kiosk";

type Props = {
  device: KioskDevice;
  onClose: () => void;
  onSetup: (d: KioskDevice) => void;
  onCopyUrl: (d: KioskDevice) => void;
  onToggleActive: (d: KioskDevice) => void;
  onDelete: (d: KioskDevice) => void;
};

/** Row actions for one kiosk device, as a bottom-sheet menu (same on phone and desktop). */
export function DeviceActionsSheet({ device, onClose, onSetup, onCopyUrl, onToggleActive, onDelete }: Props) {
  const run = (fn: (d: KioskDevice) => void) => { fn(device); onClose(); };
  return (
    <Sheet open onClose={onClose} title={device.name} size="auto">
      <div className="space-y-2">
        <Button variant="secondary" icon="external" className="w-full justify-start" onClick={() => run(onSetup)}>Set up this device</Button>
        <Button variant="secondary" icon="copy" className="w-full justify-start" onClick={() => run(onCopyUrl)}>Copy setup URL</Button>
        <Button variant="secondary" icon={device.isActive ? "close" : "check"} className="w-full justify-start" onClick={() => run(onToggleActive)}>{device.isActive ? "Disable" : "Enable"}</Button>
        <Button variant="danger" icon="trash" className="w-full justify-start" onClick={() => run(onDelete)}>Delete</Button>
      </div>
    </Sheet>
  );
}
