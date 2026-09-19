import type { QueryResult } from "@/types/query";

const LONG_TEXT_THRESHOLD = 60;

function formatCell(value: unknown, type: string): { display: string; isNull: boolean } {
  if (value === null || value === undefined) return { display: "NULL", isNull: true };
  if (type === "boolean") return { display: value ? "true" : "false", isNull: false };
  if (type === "date") {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) {
      const iso = String(value);
      return { display: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : d.toLocaleString(), isNull: false };
    }
    return { display: String(value), isNull: false };
  }
  if (type === "number") {
    const n = value as number;
    return { display: Number.isFinite(n) ? n.toLocaleString() : String(value), isNull: false };
  }
  if (typeof value === "object") return { display: JSON.stringify(value), isNull: false };
  return { display: String(value), isNull: false };
}

export function ResultTable({ result, isWrite }: { result: QueryResult; isWrite?: boolean }) {
  if (result.rowCount === 0) {
    return <div className="motion-panel rounded-sm border border-ink-800 bg-ink-950 px-5 py-10 text-center"><p className="text-sm text-ink-400">{isWrite ? "The statement ran successfully." : "The query ran successfully and returned no rows."}</p></div>;
  }

  return (
    <div className="motion-panel rounded-sm border border-ink-800 bg-ink-950">
      <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-widest2 text-ink-400">Results</span>
        <span className="text-xs text-ink-500">{result.rowCount.toLocaleString()} row{result.rowCount === 1 ? "" : "s"} · {result.columns.length} column{result.columns.length === 1 ? "" : "s"}</span>
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead><tr className="border-b border-ink-800">{result.columns.map((col)=><th key={col} scope="col" className="whitespace-nowrap px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-accent-400">{col}</th>)}</tr></thead>
          <tbody>
            {result.rows.map((row,i)=><tr key={i} className="group border-b border-ink-900 last:border-b-0 transition-colors duration-300 hover:bg-ink-900/70">
              {result.columns.map((col)=>{const type=result.columnTypes[col]??"string";const {display,isNull}=formatCell(row[col],type);const isLong=display.length>LONG_TEXT_THRESHOLD;return <td key={col} className={`max-w-xs px-5 py-3.5 align-top transition-transform duration-300 group-hover:translate-x-[1px] ${isNull?"italic text-ink-600":"text-ink-200"} ${type==="number"?"text-right font-mono tabular-nums":""}`} title={isLong?display:undefined}><span className={isLong?"line-clamp-2 block":"block"}>{display}</span></td>})}
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
