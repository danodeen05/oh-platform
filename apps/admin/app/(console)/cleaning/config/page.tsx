"use client";
import { useLocationFilter } from "@/components/providers/LocationProvider";
import { Card } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PodConfigurator } from "./pod-configurator";

const BACK = { href: "/cleaning", label: "Cleaning display" };

export default function SeatsPage() {
  const { locationId, locations, setLocationId } = useLocationFilter();

  return (
    <>
      <PageHeader title="Seats" back={BACK} />
      {locationId === "all" ? (
        <Card>
          <Field label="Location" hint="Choose a location to configure its seating pods.">
            <Select value="" onChange={(e) => setLocationId(e.target.value)}>
              <option value="" disabled>Select location...</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
        </Card>
      ) : (
        <PodConfigurator locationId={locationId} />
      )}
    </>
  );
}
