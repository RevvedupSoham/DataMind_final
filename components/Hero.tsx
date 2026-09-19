import { Reveal } from "@/components/Reveal";

const PATH = [
  ["01","Question","natural language"], ["02","SQL","Groq translation"],
  ["03","Access","role + employee scope"], ["04","Database","PostgreSQL"],
  ["05","Result","rows + optional chart"],
];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-ink-800 bg-ink-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage:"linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)", backgroundSize:"72px 72px" }} />
        <div className="absolute right-[-14%] top-[8%] h-[520px] w-[520px] rounded-full bg-accent-500/[0.06] blur-[130px] motion-safe:animate-pulse" />
        <div className="absolute bottom-0 left-0 h-px w-[42%] bg-gradient-to-r from-accent-400/70 to-transparent" />
      </div>
      <div className="section relative z-10 grid min-h-[calc(100vh-72px)] items-center gap-16 pb-20 pt-32 lg:grid-cols-[1.08fr_0.92fr] lg:gap-24 lg:pb-24 lg:pt-36">
        <div>
          <Reveal><div className="flex items-center gap-3"><span className="eyebrow">Natural language / PostgreSQL</span><span className="h-px w-10 bg-ink-700"/><span className="font-mono text-[9px] text-ink-600">DATAMIND / 01</span></div></Reveal>
          <Reveal delay={90}><h1 className="mt-7 max-w-5xl font-display text-[3.45rem] leading-[0.91] tracking-[-0.045em] text-ink-100 sm:text-6xl lg:text-[6.1rem]">Ask your database<br/><span className="italic text-accent-400">in plain English.</span></h1></Reveal>
          <Reveal delay={180}><p className="mt-8 max-w-xl text-base leading-7 text-ink-400 sm:text-lg">DataMind translates a question into PostgreSQL, validates it independently, checks the user&apos;s data scope, and returns the answer from the real database.</p></Reveal>
          <Reveal delay={270}><div className="mt-10 flex flex-wrap gap-3"><a href="#ask" className="btn-primary">Start asking <span aria-hidden>↗</span></a><a href="#how-it-works" className="btn-ghost">See the process</a></div></Reveal>
          <Reveal delay={360}><div className="mt-14 grid max-w-2xl grid-cols-1 gap-3 border-t border-ink-800 pt-5 sm:grid-cols-3">{["Real PostgreSQL","Employee-level access","SQL transparency"].map((item,i)=><div key={item} className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-ink-500"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400"/><span>{item}</span><span className="ml-auto font-mono text-[9px] text-ink-700">0{i+1}</span></div>)}</div></Reveal>
        </div>
        <Reveal delay={220}>
          <div className="motion-panel border border-ink-800 bg-ink-900/70">
            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">Query path</span><span className="font-mono text-[9px] text-accent-400">SOURCE OF TRUTH / DB</span></div>
            <div className="divide-y divide-ink-800">{PATH.map(([n,title,meta],index)=><div key={n} className="group flex items-center gap-4 px-5 py-5 transition-all duration-500 hover:bg-ink-800/40"><span className="font-mono text-[10px] text-ink-600">{n}</span><span className="relative h-2 w-2 shrink-0 rounded-full border border-accent-400/70"><span className="absolute inset-0 rounded-full bg-accent-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100"/></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink-100 transition-transform duration-300 group-hover:translate-x-1">{title}</p><p className="mt-0.5 text-xs text-ink-600">{meta}</p></div>{index<PATH.length-1&&<span className="text-ink-700 transition-transform duration-300 group-hover:translate-y-1">↓</span>}</div>)}</div>
            <div className="border-t border-ink-800 px-5 py-5"><div className="flex items-center justify-between gap-4"><p className="font-mono text-[10px] leading-5 text-ink-600">LLM translates. PostgreSQL answers.</p><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-30"/><span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400"/></span></div></div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
