/**
 * The NDA as a sheet of Oh! paper: logo head, Key Terms ledger, numbered
 * clauses and the two signature blocks. Presentational and shared by the
 * signing page (live, filling in as the signer types) and print.
 */

import { COMPANY } from "@/lib/plan/nda/content";
import { formatAddress, type NdaDocument as Doc } from "@/lib/plan/nda/document";

interface Props {
  doc: Doc;
  countersigner: { name: string; title: string; signature: string } | null;
  recipientSignature: string | null;
  signedLabel?: string | null;
}

const letter = (i: number) => String.fromCharCode(97 + i);

export function NdaDocument({ doc, countersigner, recipientSignature, signedLabel }: Props) {
  const r = doc.recipient;
  return (
    <article
      aria-label={doc.title}
      className="relative overflow-hidden rounded-[18px] bg-oh-paper text-oh-ink shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)] ring-1 ring-black/5 print:rounded-none print:shadow-none print:ring-0"
    >
      <div className="h-2 bg-oh-charcoal" aria-hidden="true" />
      <div className="h-[2px] bg-oh-gold" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/plan/mark-web-128.png" alt="" aria-hidden="true" className="pointer-events-none absolute right-[-60px] top-[420px] w-[420px] select-none opacity-[0.035]" />

      <div className="relative px-6 pb-10 pt-10 sm:px-12 sm:pt-14 lg:px-16">
        <header className="mb-10 flex items-start justify-between gap-6">
          <div>
            <p className="m-0 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-oh-ember-deep">{COMPANY.legalName}</p>
            <h2 className="m-0 mt-3 font-display text-[clamp(2rem,4.6vw,3rem)] font-normal leading-[1.05] text-oh-charcoal">{doc.title}</h2>
            <div className="mt-5 h-[2px] w-20 bg-oh-gold" />
            <p className="m-0 mt-4 font-display text-[1.1rem] italic text-oh-stone">
              {r?.legalName ? `Prepared for ${r.legalName}` : "Prepared for you"}
              {r?.company ? <span className="not-italic text-oh-ash">{`, ${r.company}`}</span> : null}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/plan/mark-web-128.png" alt="Oh!" width={88} height={87} className="hidden h-auto w-[88px] shrink-0 sm:block" />
        </header>

        <section aria-labelledby="nda-key-terms">
          <p id="nda-key-terms" className="m-0 mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-oh-ember-deep">
            Key Terms
          </p>
          <dl className="m-0 border-t border-[#E4D9C3]">
            {doc.keyTerms.map((t) => (
              <div key={t.label} className="grid gap-1 border-b border-[#E4D9C3] py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="pt-[3px] text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-oh-ash">{t.label}</dt>
                <dd className="m-0 font-display text-[1.08rem] leading-snug text-oh-charcoal">{t.value}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 mt-5 text-[0.92rem] italic leading-relaxed text-oh-stone">{doc.preamble}</p>
        </section>

        <div className="my-10 flex items-center gap-4" aria-hidden="true">
          <div className="h-px flex-1 bg-[#E4D9C3]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/plan/mark-web-128.png" alt="" className="h-7 w-auto opacity-70" />
          <div className="h-px flex-1 bg-[#E4D9C3]" />
        </div>

        <section aria-label="Standard terms" className="flex flex-col gap-8">
          {doc.clauses.map((c) => (
            <section key={c.n} aria-labelledby={`nda-s${c.n}`} className="grid grid-cols-[2.4rem_1fr] gap-x-3 sm:grid-cols-[3.2rem_1fr] print:break-inside-avoid-page">
              <span aria-hidden="true" className="font-display text-[1.9rem] leading-none text-oh-ember sm:text-[2.3rem]">
                {c.n}
              </span>
              <div>
                <h3 id={`nda-s${c.n}`} className="m-0 mb-2 font-display text-[1.3rem] font-normal leading-tight text-oh-charcoal">
                  <span className="sr-only">{`Section ${c.n}. `}</span>
                  {c.title}
                </h3>
                <div className="flex flex-col gap-3 text-[0.95rem] leading-[1.7] text-oh-ink">
                  {c.blocks.map((b, i) =>
                    typeof b === "string" ? (
                      <p key={i} className="m-0">{b}</p>
                    ) : (
                      <ol key={i} className="m-0 flex list-none flex-col gap-1.5 p-0">
                        {b.list.map((item, j) => (
                          <li key={j} className="grid grid-cols-[1.9rem_1fr]">
                            <span className="font-semibold text-oh-ember-deep">({letter(j)})</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    ),
                  )}
                </div>
              </div>
            </section>
          ))}
        </section>

        <section aria-label="Signatures" className="mt-12 print:break-before-page">
          <p className="m-0 mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-oh-ember-deep">Signatures</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E4D9C3] bg-white/70 p-5">
              <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-oh-ash">Recipient</p>
              <div className="mt-3 flex h-20 items-end border-b-2 border-oh-ember pb-1">
                {recipientSignature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recipientSignature} alt={`Signature of ${r?.legalName ?? "the recipient"}`} className="max-h-[72px] max-w-full object-contain" />
                ) : (
                  <span className="text-[0.85rem] italic text-oh-ash">Your signature appears here</span>
                )}
              </div>
              <p className="m-0 mt-2 font-display text-[1.15rem] text-oh-charcoal">{r?.legalName || "Your full legal name"}</p>
              {r?.company ? <p className="m-0 text-[0.8rem] text-oh-ash">{[r.title, r.company].filter(Boolean).join(", ")}</p> : null}
              {r ? <p className="m-0 text-[0.8rem] text-oh-ash">{formatAddress(r.address)}</p> : null}
              <p className="m-0 mt-1 text-[0.8rem] text-oh-ash">{signedLabel ?? `Effective ${doc.effectiveDate}`}</p>
            </div>
            <div className="rounded-xl border border-[#E4D9C3] bg-white/70 p-5">
              <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-oh-ash">{COMPANY.legalName}</p>
              <div className="mt-3 flex h-20 items-end border-b-2 border-oh-ember pb-1">
                {countersigner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={countersigner.signature} alt={`Signature of ${countersigner.name}`} className="max-h-[72px] max-w-full object-contain" />
                ) : (
                  <span className="text-[0.85rem] italic text-oh-ash">Countersigned on signing</span>
                )}
              </div>
              <p className="m-0 mt-2 font-display text-[1.15rem] text-oh-charcoal">{countersigner?.name ?? "Oh! Beef Noodle Soup"}</p>
              {countersigner ? <p className="m-0 text-[0.8rem] text-oh-ash">{countersigner.title}</p> : null}
              <p className="m-0 text-[0.8rem] text-oh-ash">{COMPANY.address}</p>
              <p className="m-0 mt-1 text-[0.8rem] text-oh-ash">Applied automatically when you sign</p>
            </div>
          </div>
          <p className="m-0 mt-6 text-center text-[0.72rem] tracking-wide text-oh-ash">
            {COMPANY.legalName} · Confidential · Version {doc.version}
          </p>
        </section>
      </div>
    </article>
  );
}
