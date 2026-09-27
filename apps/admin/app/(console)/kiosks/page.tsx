"use client";
import { useState } from "react";
import { DeviceActionsSheet } from "@/components/kiosks/DeviceActionsSheet";
import { RegisterDeviceSheet } from "@/components/kiosks/RegisterDeviceSheet";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { deviceStatus, kioskSetupUrl, type KioskDevice } from "@/lib/kiosk";
import { useResource } from "@/lib/use-resource";

type LocationOption = { id: string; name: string };
const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

const LEGEND: { label: string; tone: BadgeTone }[] = [
  { label: "Online, under 2 min", tone: "good" },
  { label: "Stale, under 10 min", tone: "pending" },
  { label: "Offline, 10+ min", tone: "alert" },
  { label: "Never connected or disabled", tone: "neutral" },
];

export default function KiosksPage() {
  const { show } = useToast();
  const ask = useConfirm();

  const devicesRes = useResource("kiosk-devices", (signal) => api<KioskDevice[]>("/kiosk-devices", { signal }));
  const locationsRes = useResource("kiosk-locations", (signal) => api<LocationOption[]>("/locations", { signal }));
  const locations = locationsRes.data ?? [];

  const [registerOpen, setRegisterOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<KioskDevice | null>(null);

  async function setupThisDevice(d: KioskDevice) {
    const ok = await ask({ title: `Set up "${d.name}" on this device?`, body: "This generates a new setup key. Any earlier setup link for this device stops working.", confirmLabel: "Continue" });
    if (!ok) return;
    try {
      const data = await api<{ apiKey: string }>(`/kiosk-devices/${d.id}/rotate-key`, { method: "POST" });
      window.location.href = kioskSetupUrl(data.apiKey);
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  async function copySetupUrl(d: KioskDevice) {
    const ok = await ask({ title: `Copy a new setup URL for "${d.name}"?`, body: "The previous setup URL stops working.", confirmLabel: "Continue" });
    if (!ok) return;
    try {
      const data = await api<{ apiKey: string }>(`/kiosk-devices/${d.id}/rotate-key`, { method: "POST" });
      const url = kioskSetupUrl(data.apiKey);
      await navigator.clipboard?.writeText(url);
      show({ message: "Setup URL copied", tone: "good" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  async function toggleActive(d: KioskDevice) {
    const next = !d.isActive;
    if (!next) {
      const ok = await ask({ title: `Disable "${d.name}"?`, body: "It stops being usable until re-enabled.", confirmLabel: "Disable", tone: "danger" });
      if (!ok) return;
    }
    try {
      await api(`/kiosk-devices/${d.id}`, { method: "PUT", body: { isActive: next } });
      devicesRes.reload();
      show({ message: next ? `${d.name} enabled.` : `${d.name} disabled.`, tone: next ? "good" : "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  async function remove(d: KioskDevice) {
    const ok = await ask({ title: `Delete "${d.name}"?`, body: "This can't be undone.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try {
      await api(`/kiosk-devices/${d.id}`, { method: "DELETE" });
      devicesRes.reload();
      show({ message: `${d.name} deleted.`, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  const COLUMNS: Column<KioskDevice>[] = [
    { key: "status", label: "Status", render: (d) => { const s = deviceStatus(d); return <Badge tone={s.tone}>{s.label}</Badge>; } },
    { key: "device", label: "Device", render: (d) => (
      <>
        <span className="font-semibold text-oh-charcoal">{d.name}</span>
        <span className="block font-mono text-sm text-oh-stone/60">{d.deviceId}</span>
      </>
    ) },
    { key: "location", label: "Location", render: (d) => d.location.name },
    { key: "lastSeen", label: "Last seen", render: (d) => (d.lastHeartbeat ? relativeTime(d.lastHeartbeat) : "Never") },
    { key: "version", label: "Version", render: (d) => <span className="font-mono text-sm text-oh-stone/70">{d.appVersion || "-"}</span> },
    { key: "actions", label: "", align: "right", render: (d) => <IconButton icon="more" label={`Actions for ${d.name}`} onClick={() => setMenuFor(d)} /> },
  ];

  return (
    <>
      <PageHeader title="Kiosks" actions={<Button variant="primary" icon="plus" onClick={() => setRegisterOpen(true)}>Register device</Button>} />

      <div className="space-y-4">
        {devicesRes.error && !devicesRes.data ? (
          <ErrorCard message="Couldn't load kiosk devices." onRetry={devicesRes.reload} />
        ) : !devicesRes.data ? (
          <SkeletonList rows={4} />
        ) : (
          <DataList rows={devicesRes.data} rowKey={(d) => d.id} columns={COLUMNS}
            empty={<EmptyState icon="tablet" title="No kiosk devices yet" body="Register your first one." action={<Button variant="primary" icon="plus" onClick={() => setRegisterOpen(true)}>Register device</Button>} />}
            renderCard={(d) => {
              const status = deviceStatus(d);
              return (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-oh-charcoal">{d.name}</span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-sm text-oh-stone/60">{d.deviceId}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-oh-stone/70">
                      <span>{d.location.name}</span>
                      <span>{d.lastHeartbeat ? relativeTime(d.lastHeartbeat) : "Never seen"}</span>
                      {d.appVersion && <span className="font-mono">{d.appVersion}</span>}
                    </p>
                  </div>
                  <IconButton icon="more" label={`Actions for ${d.name}`} onClick={() => setMenuFor(d)} />
                </div>
              );
            }} />
        )}

        <div className="flex flex-wrap gap-2">
          {LEGEND.map((l) => <Badge key={l.label} tone={l.tone}>{l.label}</Badge>)}
        </div>
      </div>

      {registerOpen && (
        <RegisterDeviceSheet open locations={locations} onClose={() => setRegisterOpen(false)} onRegistered={() => devicesRes.reload()} />
      )}
      {menuFor && (
        <DeviceActionsSheet device={menuFor} onClose={() => setMenuFor(null)}
          onSetup={setupThisDevice} onCopyUrl={copySetupUrl} onToggleActive={toggleActive} onDelete={remove} />
      )}
    </>
  );
}
