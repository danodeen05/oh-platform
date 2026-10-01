"use client";
import { QRCodeSVG } from "qrcode.react";
import { EnrichmentReview } from "../../_components/EnrichmentReview";
import { LogoUpload } from "../../_components/LogoUpload";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { StatTile } from "@/components/ui/StatTile";
import { money } from "@/lib/format";
import type { CateringEvent } from "@/lib/catering";
import { webUrl } from "@/lib/urls";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-oh-stone/60">{label}</p>
      <div className="text-[15px] text-oh-charcoal">{children}</div>
    </div>
  );
}

export default function OverviewTab({ event, onRefresh }: { event: CateringEvent; onRefresh: () => void }) {
  const origin = webUrl();
  const attendeeUrl = `${origin}/en/e/${event.slug}`;
  const dashboardUrl = event.booking?.bookingToken ? `${origin}/en/catering/dashboard/${event.booking.bookingToken}` : null;
  const showEnrichment = event.status === "NEEDS_REVIEW" || event.status === "ENRICHING";

  return (
    <div className="space-y-4 lg:space-y-6">
      <Card title="Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Row label="Client company">{event.clientCompany}</Row>
          {event.clientWebsite && (
            <Row label="Website">
              <a href={event.clientWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all text-oh-ember-deep hover:underline">
                <Icon name="external" size={16} />{event.clientWebsite}
              </a>
            </Row>
          )}
          {(event.contactName || event.contactEmail || event.contactPhone) && (
            <Row label="Contact">
              {event.contactName && <span className="block">{event.contactName}</span>}
              {event.contactEmail && <a href={`mailto:${event.contactEmail}`} className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-oh-ember-deep hover:underline"><Icon name="mail" size={16} />{event.contactEmail}</a>}
              {event.contactPhone && <a href={`tel:${event.contactPhone}`} className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-oh-ember-deep hover:underline"><Icon name="phone" size={16} />{event.contactPhone}</a>}
            </Row>
          )}
          {event.eventAddress && (
            <Row label="Event address">
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.eventAddress)}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-oh-ember-deep hover:underline"><Icon name="pin" size={16} />{event.eventAddress}</a>
            </Row>
          )}
          {event.hostName && <Row label="Host">{event.hostName}</Row>}
          {event.welcomeNote && <div className="sm:col-span-2"><Row label="Welcome note"><p className="whitespace-pre-wrap">{event.welcomeNote}</p></Row></div>}
          <Row label="Event code"><code className="rounded bg-oh-stone/10 px-2 py-0.5 font-mono text-sm">{event.eventCode}</code></Row>
          {event.eventType && <Row label="Event type">{event.eventType}</Row>}
          {event.expectedGuests != null && <Row label="Expected guests">{event.expectedGuests}</Row>}
          {(event.onsiteContactName || event.onsiteContactPhone) && (
            <Row label="Day-of on-site contact">
              {event.onsiteContactName && <span className="block">{event.onsiteContactName}</span>}
              {event.onsiteContactPhone && <span className="block text-sm text-oh-stone/70">{event.onsiteContactPhone}</span>}
            </Row>
          )}
          {event.dietaryNotes && <div className="sm:col-span-2"><Row label="Dietary needs"><p className="whitespace-pre-wrap">{event.dietaryNotes}</p></Row></div>}
          {event.setupNotes && <div className="sm:col-span-2"><Row label="Setup and space notes"><p className="whitespace-pre-wrap">{event.setupNotes}</p></Row></div>}
          {event.notes && <div className="sm:col-span-2"><Row label="Notes"><p className="whitespace-pre-wrap">{event.notes}</p></Row></div>}
        </div>
      </Card>

      <Card title="Logo"><LogoUpload eventId={event.id} currentLogoUrl={event.logoUrl} onSaved={onRefresh} /></Card>

      {event.booking ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Bowls booked" value={event.booking.bowlsBooked} />
          <StatTile label="Price per bowl" value={money(event.pricePerBowlCents)} />
          <StatTile label="Total charged" value={money(event.booking.priceCents)} />
          <StatTile label="Amount paid" value={money(event.booking.paidCents)} hint={event.booking.paymentStatus}
            tone={event.booking.paidCents >= event.booking.priceCents ? "good" : "pending"} />
        </div>
      ) : (
        <Card>
          <p className="text-[15px] text-oh-clay">
            No booking confirmed yet. Minimum commitment: {event.minimumBowls} bowls at {money(event.pricePerBowlCents)}/bowl = {money(event.minimumBowls * event.pricePerBowlCents)}.
          </p>
        </Card>
      )}

      {showEnrichment && <Card title="AI brand enrichment"><EnrichmentReview eventId={event.id} onPublished={onRefresh} /></Card>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="Attendee event page" className="text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl bg-white p-3"><QRCodeSVG value={attendeeUrl} size={160} level="H" /></div>
            <a href={attendeeUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-oh-ember-deep hover:underline">Open link</a>
          </div>
        </Card>
        {dashboardUrl && (
          <Card title="Client dashboard" className="text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl bg-white p-3"><QRCodeSVG value={dashboardUrl} size={160} level="H" /></div>
              <a href={dashboardUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-oh-ember-deep hover:underline">Open link</a>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
