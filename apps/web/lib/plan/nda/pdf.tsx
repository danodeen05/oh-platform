/**
 * The fully executed NDA as a Letter-size PDF (server only, @react-pdf/renderer,
 * no browser needed). Same words as the online page: both come from
 * buildNdaDocument(). Pages: cover, Key Terms, the clauses, signatures, and a
 * certificate of completion (the audit trail).
 *
 * Fonts and the logo live in lib/plan/nda/assets and are read from disk; the
 * sign route lists them in next.config outputFileTracingIncludes so Vercel
 * ships them with the function.
 */

import path from "node:path";
import { readFileSync } from "node:fs";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { COMPANY } from "./content";
import { formatAddress, type NdaDocument } from "./document";

const ASSETS = path.join(process.cwd(), "lib", "plan", "nda", "assets");
const font = (name: string) => path.join(ASSETS, "fonts", name);

let registered = false;
function registerFonts(): void {
  if (registered) return;
  Font.register({
    family: "Instrument Serif",
    fonts: [
      { src: font("InstrumentSerif-Regular.ttf") },
      { src: font("InstrumentSerif-Italic.ttf"), fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "Raleway",
    fonts: [
      { src: font("raleway-400.woff"), fontWeight: 400 },
      { src: font("raleway-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
      { src: font("raleway-500.woff"), fontWeight: 500 },
      { src: font("raleway-600.woff"), fontWeight: 600 },
      { src: font("raleway-700.woff"), fontWeight: 700 },
    ],
  });
  // Legal text reads better without automatic hyphenation.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

let markCache: Buffer | null = null;
function mark(): Buffer {
  if (!markCache) markCache = readFileSync(path.join(ASSETS, "mark-web-600.png"));
  return markCache;
}

const C = {
  paper: "#FAF7F1",
  cream: "#F2EDE4",
  charcoal: "#1C1B19",
  ink: "#2A2724",
  stone: "#3A3632",
  ash: "#8A8178",
  ember: "#C1502E",
  emberDeep: "#A94422",
  gold: "#C9A227",
  rule: "#E4D9C3",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.paper, color: C.ink, fontFamily: "Raleway", fontSize: 9.4, lineHeight: 1.55, paddingTop: 76, paddingBottom: 64, paddingHorizontal: 60 },
  watermark: { position: "absolute", top: 250, left: 156, width: 300, height: 297, opacity: 0.035 },
  header: { position: "absolute", top: 26, left: 60, right: 60, flexDirection: "row", alignItems: "center", borderBottomWidth: 0.6, borderBottomColor: C.rule, paddingBottom: 8 },
  headerMark: { width: 22, height: 22, marginRight: 9 },
  headerTitle: { fontFamily: "Instrument Serif", fontSize: 12, color: C.charcoal },
  headerRight: { marginLeft: "auto", fontSize: 7, letterSpacing: 1.4, color: C.ash, textTransform: "uppercase" },
  footer: { position: "absolute", bottom: 28, left: 60, right: 60, flexDirection: "row", fontSize: 7, color: C.ash, letterSpacing: 0.4 },
  footerRight: { marginLeft: "auto" },
  eyebrow: { fontSize: 7.5, letterSpacing: 2.2, textTransform: "uppercase", color: C.emberDeep, fontWeight: 600 },
  h1: { fontFamily: "Instrument Serif", fontSize: 30, color: C.charcoal, lineHeight: 1.15, marginTop: 6 },
  goldRule: { height: 1.2, backgroundColor: C.gold, width: 64, marginTop: 14, marginBottom: 16 },
  clause: { flexDirection: "row" },
  num: { width: 34, fontFamily: "Instrument Serif", fontSize: 19, color: C.ember, lineHeight: 1 },
  clauseBody: { flex: 1 },
  clauseTitle: { fontFamily: "Instrument Serif", fontSize: 13.5, color: C.charcoal, marginBottom: 3, lineHeight: 1.2 },
  para: { textAlign: "justify" },
  listRow: { flexDirection: "row", paddingTop: 3, paddingLeft: 4 },
  listLabel: { width: 18, color: C.emberDeep, fontWeight: 600 },
  listText: { flex: 1, textAlign: "justify" },
  termRow: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: C.rule, paddingVertical: 7 },
  termLabel: { width: 118, fontSize: 7.2, letterSpacing: 1.3, textTransform: "uppercase", color: C.ash, fontWeight: 600, paddingTop: 2 },
  termValue: { flex: 1, fontFamily: "Instrument Serif", fontSize: 11.5, color: C.charcoal, lineHeight: 1.35 },
  sigBox: { flex: 1, borderWidth: 0.8, borderColor: C.rule, borderRadius: 6, padding: 14, backgroundColor: "#FFFDF8" },
  sigImageWrap: { height: 64, justifyContent: "flex-end", borderBottomWidth: 1, borderBottomColor: C.ember, marginBottom: 7, marginTop: 10 },
  sigImage: { maxHeight: 60, maxWidth: 200, objectFit: "contain" },
  small: { fontSize: 7.8, color: C.ash, lineHeight: 1.45 },
  certRow: { flexDirection: "row", paddingVertical: 3.2, borderBottomWidth: 0.5, borderBottomColor: C.rule },
  certLabel: { width: 130, fontSize: 7.4, letterSpacing: 0.9, textTransform: "uppercase", color: C.ash, fontWeight: 600, paddingTop: 1 },
  certValue: { flex: 1, fontSize: 8.6, color: C.ink },
  mono: { fontFamily: "Courier", fontSize: 8 },
});

export interface NdaPdfInput {
  doc: NdaDocument;
  ndaId: string;
  signedAt: Date;
  recipientSignature: string; // PNG data URL
  signatureKind: "typed" | "drawn";
  countersigner: { name: string; title: string; signature: string };
  audit: {
    openedAt?: string | null;
    detailsAt?: string | null;
    phoneVerifiedAt?: string | null;
    ip: string;
    userAgent: string;
    documentSha256: string;
  };
}

function both(value: string | Date | null | undefined): string {
  if (!value) return "Not recorded";
  const d = new Date(value);
  const denver = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", dateStyle: "medium", timeStyle: "medium" }).format(d);
  return `${denver} MT  ·  ${d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")}`;
}

function Chrome({ doc }: { doc: NdaDocument }) {
  return (
    <>
      <Image fixed src={{ data: mark(), format: "png" }} style={s.watermark} />
      <View fixed style={s.header}>
        <Image src={{ data: mark(), format: "png" }} style={s.headerMark} />
        <Text style={s.headerTitle}>{doc.title}</Text>
        <Text style={s.headerRight}>Version {doc.version}</Text>
      </View>
      <View fixed style={s.footer}>
        <Text>{COMPANY.legalName}  ·  Confidential</Text>
        <Text style={s.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </>
  );
}

// Spacing goes ABOVE blocks (marginTop/paddingTop), never below: a bottom
// margin that crosses the page end makes react-pdf start an empty page.
function Block({ block, first = false }: { block: NdaDocument["clauses"][number]["blocks"][number]; first?: boolean }) {
  if (typeof block === "string") return <Text style={[s.para, { marginTop: first ? 0 : 5 }]}>{block}</Text>;
  return (
    <View style={{ marginTop: first ? 0 : 4 }}>
      {block.list.map((item, j) => (
        <View key={j} style={s.listRow} wrap={false}>
          <Text style={s.listLabel}>({String.fromCharCode(97 + j)})</Text>
          <Text style={s.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Cover({ doc, ndaId }: { doc: NdaDocument; ndaId: string }) {
  const r = doc.recipient;
  return (
    <Page size="LETTER" style={[s.page, { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }]}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, backgroundColor: C.charcoal }} />
      <View style={{ position: "absolute", top: 8, left: 0, right: 0, height: 2, backgroundColor: C.gold }} />
      <View style={{ paddingHorizontal: 72, paddingTop: 118, flex: 1 }}>
        <Image src={{ data: mark(), format: "png" }} style={{ width: 150, height: 148, marginBottom: 40 }} />
        <Text style={s.eyebrow}>{COMPANY.legalName}</Text>
        <Text style={[s.h1, { fontSize: 40, marginTop: 10 }]}>{doc.title}</Text>
        <View style={[s.goldRule, { width: 88, marginTop: 20, marginBottom: 22 }]} />
        <Text style={{ fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 15, color: C.stone }}>Prepared for {r?.legalName ?? "the Recipient"}</Text>
        {r?.company ? <Text style={{ fontFamily: "Instrument Serif", fontSize: 13, color: C.ash, marginTop: 3 }}>{r.company}</Text> : null}
        <Text style={{ marginTop: 26, fontSize: 9.5, color: C.stone, lineHeight: 1.6, maxWidth: 360 }}>
          A one-way agreement protecting the recipes, formats, plans, numbers and technology behind Oh! Beef Noodle Soup, shared with you in confidence.
        </Text>
      </View>
      <View style={{ paddingHorizontal: 72, paddingBottom: 54, flexDirection: "row", fontSize: 7.4, color: C.ash, letterSpacing: 0.6 }}>
        <Text>Effective {doc.effectiveDate}</Text>
        <Text style={{ marginHorizontal: 8 }}>·</Text>
        <Text>Version {doc.version}</Text>
        <Text style={{ marginLeft: "auto" }}>Document ID {ndaId}</Text>
      </View>
    </Page>
  );
}

function NdaPdf(input: NdaPdfInput) {
  const { doc, ndaId, countersigner, audit } = input;
  const r = doc.recipient;
  return (
    <Document title={`${doc.title}, ${r?.legalName ?? ""}`} author={COMPANY.legalName} subject="Fully executed confidential disclosure agreement" creator="Oh! Beef Noodle Soup" producer="Oh! Beef Noodle Soup">
      <Cover doc={doc} ndaId={ndaId} />

      <Page size="LETTER" style={s.page}>
        <Chrome doc={doc} />
        <Text style={s.eyebrow}>Key Terms</Text>
        <Text style={s.h1}>The short version</Text>
        <View style={s.goldRule} />
        <View style={{ borderTopWidth: 0.6, borderTopColor: C.rule }}>
          {doc.keyTerms.map((t) => (
            <View key={t.label} style={s.termRow} wrap={false}>
              <Text style={s.termLabel}>{t.label}</Text>
              <Text style={s.termValue}>{t.value}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.para, { marginTop: 16, fontStyle: "italic", color: C.stone }]}>{doc.preamble}</Text>
      </Page>

      <Page size="LETTER" style={s.page}>
        <Chrome doc={doc} />
        <Text style={s.eyebrow}>Standard Terms</Text>
        <Text style={[s.h1, { marginBottom: 4 }]}>The agreement</Text>
        <View style={s.goldRule} />
        {doc.clauses.map((c) => {
          const [first, ...rest] = c.blocks;
          // The number, title and first paragraph stay together so a title never ends a page.
          return (
            <View key={c.n} style={{ paddingTop: c.n === 1 ? 0 : 11 }}>
              <View style={s.clause} wrap={false}>
                <Text style={s.num}>{c.n}</Text>
                <View style={s.clauseBody}>
                  <Text style={s.clauseTitle}>{c.title}</Text>
                  {first !== undefined ? <Block block={first} first /> : null}
                </View>
              </View>
              {rest.map((b, i) => (
                <View key={i} style={s.clause}>
                  <View style={{ width: 34 }} />
                  <View style={s.clauseBody}>
                    <Block block={b} />
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </Page>

      <Page size="LETTER" style={s.page}>
        <Chrome doc={doc} />
        <View>
          <Text style={s.eyebrow}>Signatures</Text>
          <Text style={s.h1}>Agreed and signed</Text>
          <View style={s.goldRule} />
          <Text style={[s.para, { color: C.stone }]}>Each party signs this Agreement electronically as of the Effective Date, {doc.effectiveDate}.</Text>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 14 }} wrap={false}>
            <View style={s.sigBox}>
              <Text style={s.eyebrow}>Recipient</Text>
              <View style={s.sigImageWrap}>
                <Image src={input.recipientSignature} style={s.sigImage} />
              </View>
              <Text style={{ fontFamily: "Instrument Serif", fontSize: 13, color: C.charcoal }}>{r?.legalName}</Text>
              {r?.company ? <Text style={s.small}>{[r.title, r.company].filter(Boolean).join(", ")}</Text> : null}
              <Text style={s.small}>{r?.email}</Text>
              <Text style={s.small}>{r ? formatAddress(r.address) : ""}</Text>
              <Text style={[s.small, { marginTop: 6 }]}>Signed {both(input.signedAt)}</Text>
            </View>
            <View style={s.sigBox}>
              <Text style={s.eyebrow}>{COMPANY.legalName}</Text>
              <View style={s.sigImageWrap}>
                <Image src={countersigner.signature} style={s.sigImage} />
              </View>
              <Text style={{ fontFamily: "Instrument Serif", fontSize: 13, color: C.charcoal }}>{countersigner.name}</Text>
              <Text style={s.small}>{countersigner.title}</Text>
              <Text style={s.small}>{COMPANY.address}</Text>
              <Text style={[s.small, { marginTop: 6 }]}>Countersigned {both(input.signedAt)}</Text>
            </View>
          </View>
        </View>

      </Page>

      <Page size="LETTER" style={s.page}>
        <Chrome doc={doc} />
        <View>
          <Text style={s.eyebrow}>Audit Trail</Text>
          <Text style={s.h1}>Certificate of completion</Text>
          <View style={s.goldRule} />
          {[
            ["Status", "Fully executed"],
            ["Agreement", `${doc.title}, version ${doc.version}`],
            ["Document ID", ndaId],
            ["Document SHA-256", audit.documentSha256],
            ["Signer", r?.legalName ?? ""],
            ["Email", r?.email ?? ""],
            ["Mobile", `${r?.phone ?? ""} (verified by a one-time text code)`],
            ["Signature", input.signatureKind === "typed" ? "Typed name, adopted as signature" : "Drawn by hand on screen"],
            ["IP address", audit.ip || "Not recorded"],
            ["Browser", audit.userAgent || "Not recorded"],
            ["Countersignature", `${countersigner.name}, ${countersigner.title}. Adopted signature applied automatically on signing.`],
          ].map(([k, v]) => (
            <View key={k} style={s.certRow} wrap={false}>
              <Text style={s.certLabel}>{k}</Text>
              <Text style={k === "Document SHA-256" || k === "Document ID" ? [s.certValue, s.mono] : s.certValue}>{v}</Text>
            </View>
          ))}
          <Text style={[s.eyebrow, { marginTop: 12, marginBottom: 4 }]}>Timeline</Text>
          {[
            ["Invitation opened", audit.openedAt],
            ["Details entered", audit.detailsAt],
            ["Mobile verified", audit.phoneVerifiedAt],
            ["Consented and signed", input.signedAt.toISOString()],
            ["Countersigned", input.signedAt.toISOString()],
          ].map(([k, v]) => (
            <View key={k as string} style={s.certRow} wrap={false}>
              <Text style={s.certLabel}>{k}</Text>
              <Text style={s.certValue}>{both(v)}</Text>
            </View>
          ))}
          <Text style={[s.eyebrow, { marginTop: 12, marginBottom: 4 }]}>Consents given</Text>
          <Text style={[s.para, { color: C.stone }]}>{doc.consents.electronic}</Text>
          <Text style={[s.para, { color: C.stone, marginTop: 5 }]}>{doc.consents.terms}</Text>
          <Text style={[s.small, { marginTop: 8 }]}>
            The SHA-256 fingerprint above is computed over the exact text of this Agreement as presented to the signer, including the Key Terms. Any change to the wording produces a different fingerprint. Oh! keeps this record, encrypted, with the signed PDF.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderNdaPdf(input: NdaPdfInput): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<NdaPdf {...input} />);
}
