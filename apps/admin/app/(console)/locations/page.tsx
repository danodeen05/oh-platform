"use client";
import { useState } from "react";
import { LocationSheet } from "@/components/locations/LocationSheet";
import { TenantSheet } from "@/components/locations/TenantSheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { locationAddressLine, type LocationRow, type Tenant } from "@/lib/locations";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export default function LocationsPage() {
  const { show } = useToast();
  const ask = useConfirm();

  const locationsRes = useResource("locations", (signal) => api<LocationRow[]>("/locations", { signal }));
  const tenantsRes = useResource("tenants", (signal) => api<Tenant[]>("/tenants", { signal }));
  const tenants = tenantsRes.data ?? [];
  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.brandName ?? "";

  const [locationSheet, setLocationSheet] = useState<{ location: LocationRow | null } | null>(null);
  const [tenantSheet, setTenantSheet] = useState<{ tenant: Tenant | null } | null>(null);

  async function removeLocation(l: LocationRow) {
    const ok = await ask({ title: `Delete "${l.name}"?`, body: "This can't be undone.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try {
      await api(`/locations/${l.id}`, { method: "DELETE" });
      locationsRes.reload();
      show({ message: `${l.name} deleted.`, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  async function removeTenant(t: Tenant) {
    const ok = await ask({ title: `Delete brand "${t.brandName}"?`, body: "This can't be undone.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try {
      await api(`/tenants/${t.id}`, { method: "DELETE" });
      tenantsRes.reload();
      show({ message: `${t.brandName} deleted.`, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  const LOCATION_COLUMNS: Column<LocationRow>[] = [
    { key: "name", label: "Name", render: (l) => (
      <>
        <span className="font-semibold text-oh-charcoal">{l.name}</span>
        <span className="block text-sm text-oh-stone/60">{locationAddressLine(l)}</span>
      </>
    ) },
    { key: "phone", label: "Phone", render: (l) => l.phone || "-" },
    { key: "status", label: "Status", render: (l) => <Badge tone={l.isActive ? "good" : "neutral"}>{l.isActive ? "Active" : "Inactive"}</Badge> },
    { key: "actions", label: "Actions", render: (l) => (
      <span className="flex gap-1.5">
        <Button size="sm" onClick={() => setLocationSheet({ location: l })}>Edit</Button>
        <Button size="sm" variant="danger" onClick={() => removeLocation(l)}>Delete</Button>
      </span>
    ) },
  ];

  const TENANT_COLUMNS: Column<Tenant>[] = [
    { key: "brandName", label: "Brand", render: (t) => (
      <>
        <span className="font-semibold text-oh-charcoal">{t.brandName}</span>
        <span className="block font-mono text-sm text-oh-stone/60">{t.slug}</span>
      </>
    ) },
    { key: "actions", label: "Actions", render: (t) => (
      <span className="flex gap-1.5">
        <Button size="sm" onClick={() => setTenantSheet({ tenant: t })}>Edit</Button>
        <Button size="sm" variant="danger" onClick={() => removeTenant(t)}>Delete</Button>
      </span>
    ) },
  ];

  return (
    <>
      <PageHeader title="Locations" actions={<Button variant="primary" icon="plus" onClick={() => setLocationSheet({ location: null })}>New location</Button>} />

      {locationsRes.error && !locationsRes.data ? (
        <ErrorCard message="Couldn't load locations." onRetry={locationsRes.reload} />
      ) : !locationsRes.data ? (
        <SkeletonList rows={4} />
      ) : (
        <DataList rows={locationsRes.data} rowKey={(l) => l.id} columns={LOCATION_COLUMNS}
          empty={<EmptyState icon="pin" title="No locations yet" body="Create your first one." action={<Button variant="primary" icon="plus" onClick={() => setLocationSheet({ location: null })}>New location</Button>} />}
          renderCard={(l) => (
            <div className="space-y-2 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <span>
                  <span className="block font-semibold text-oh-charcoal">{l.name}</span>
                  <span className="block text-sm text-oh-stone/60">{locationAddressLine(l)}</span>
                </span>
                <Badge tone={l.isActive ? "good" : "neutral"}>{l.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              {l.phone && <p className="text-sm text-oh-stone/70">{l.phone}</p>}
              <p className="text-sm text-oh-stone/60">{tenantName(l.tenantId)}</p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1" onClick={() => setLocationSheet({ location: l })}>Edit</Button>
                <Button size="sm" variant="danger" className="flex-1" onClick={() => removeLocation(l)}>Delete</Button>
              </div>
            </div>
          )} />
      )}

      <section id="brands" className="mt-8 scroll-mt-4">
        <PageHeader title="Brands" actions={<Button variant="primary" icon="plus" onClick={() => setTenantSheet({ tenant: null })}>New brand</Button>} />
        {tenantsRes.error && !tenantsRes.data ? (
          <ErrorCard message="Couldn't load brands." onRetry={tenantsRes.reload} />
        ) : !tenantsRes.data ? (
          <SkeletonList rows={2} />
        ) : (
          <DataList rows={tenantsRes.data} rowKey={(t) => t.id} columns={TENANT_COLUMNS}
            empty={<EmptyState icon="tag" title="No brands yet" body="Create your first one." action={<Button variant="primary" icon="plus" onClick={() => setTenantSheet({ tenant: null })}>New brand</Button>} />}
            renderCard={(t) => (
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <span>
                  <span className="block font-semibold text-oh-charcoal">{t.brandName}</span>
                  <span className="block font-mono text-sm text-oh-stone/60">{t.slug}</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => setTenantSheet({ tenant: t })}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => removeTenant(t)}>Delete</Button>
                </span>
              </div>
            )} />
        )}
      </section>

      {locationSheet && (
        <LocationSheet key={locationSheet.location?.id ?? "new"} open location={locationSheet.location} tenants={tenants}
          onClose={() => setLocationSheet(null)}
          onSaved={() => { setLocationSheet(null); locationsRes.reload(); show({ message: locationSheet.location ? "Location saved" : "Location created", tone: "good" }); }} />
      )}
      {tenantSheet && (
        <TenantSheet key={tenantSheet.tenant?.id ?? "new"} open tenant={tenantSheet.tenant}
          onClose={() => setTenantSheet(null)}
          onSaved={() => { setTenantSheet(null); tenantsRes.reload(); show({ message: tenantSheet.tenant ? "Brand saved" : "Brand created", tone: "good" }); }} />
      )}
    </>
  );
}
