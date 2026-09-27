import { PODS, type Pod, type Side } from "./layout";

interface Props {
  caption: string;
  headers: { pod: string; finger: string; side: string; position: string; aisle: string; corridor: string; type: string };
  sideLabel: (side: Side) => string;
  typeLabel: (type: Pod["type"]) => string;
}

/** The plan as data (spec 7.6): every pod, its finger and side, and what its two edges open onto. */
export function PodTable({ caption, headers, sideLabel, typeLabel }: Props) {
  const th = "px-3 py-2 text-left text-[0.66rem] font-normal uppercase tracking-[0.12em] text-oh-mute";
  const td = "px-3 py-1.5 text-[0.82rem] text-oh-cream tabular-nums";
  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-oh-stone bg-oh-ink">
      <table className="w-full border-collapse">
        <caption className="px-3 py-2 text-left text-[0.8rem] text-oh-mute">{caption}</caption>
        <thead className="sticky top-0 bg-oh-ink">
          <tr className="border-b border-oh-stone">
            <th scope="col" className={th}>{headers.pod}</th>
            <th scope="col" className={th}>{headers.finger}</th>
            <th scope="col" className={th}>{headers.side}</th>
            <th scope="col" className={th}>{headers.position}</th>
            <th scope="col" className={th}>{headers.aisle}</th>
            <th scope="col" className={th}>{headers.corridor}</th>
            <th scope="col" className={th}>{headers.type}</th>
          </tr>
        </thead>
        <tbody>
          {PODS.map((p) => (
            <tr key={p.number} className="border-b border-oh-stone/60">
              <th scope="row" className={`${td} font-normal`}>{p.number}</th>
              <td className={td}>{p.finger}</td>
              <td className={td}>{sideLabel(p.side)}</td>
              <td className={td}>{p.position}</td>
              <td className={td}>{p.aisle}</td>
              <td className={td}>{p.corridor}</td>
              <td className={`${td} ${p.type === "duo" ? "text-oh-gold" : ""}`}>{typeLabel(p.type)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
