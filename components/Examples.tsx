"use client";

import { useEffect, useState } from "react";
import { askDatabase } from "@/lib/ask-bridge";
import type { UserRole } from "@/types/auth";
import { Reveal } from "@/components/Reveal";

const EXAMPLES = [
  {title:"Second-highest salary",category:"RANKING",body:"Compare employees within a department using ranking logic.",q:"In finance, who earns the second highest salary?",adminOnly:true},
  {title:"Multi-department employees",category:"RELATIONSHIPS",body:"Find employees allocated across more than one department.",q:"Who is working in more than one department?",adminOnly:true},
  {title:"Manager hierarchies",category:"HIERARCHY",body:"Traverse direct and indirect reports using the employee manager tree.",q:"Which managers have 50 or more employees under them, direct or indirect?",adminOnly:true},
  {title:"Department headcount",category:"AGGREGATION",body:"Count employees by department without exposing individual records.",q:"How many people work in each department?",adminOnly:false},
  {title:"City distribution",category:"GEOGRAPHY",body:"Aggregate employee addresses to find the largest employee city.",q:"Which city has the most employees?",adminOnly:true},
];

export function Examples({onSelect=askDatabase}:{onSelect?:(q:string)=>void}) {
  const [role,setRole]=useState<UserRole|null>(null);
  useEffect(()=>{fetch("/api/auth/me").then(res=>res.ok?res.json():null).then(data=>{if(data?.role)setRole(data.role as UserRole)}).catch(()=>undefined)},[]);
  return <section id="examples" className="border-t border-ink-800 bg-ink-950 py-28 sm:py-36"><div className="section"><Reveal><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="eyebrow">Capabilities</p><h2 className="mt-4 max-w-2xl font-display text-4xl leading-[0.98] tracking-[-0.025em] text-ink-100 sm:text-5xl">Real questions.<br/><span className="italic text-accent-400">Real database reasoning.</span></h2></div><p className="max-w-sm text-sm leading-6 text-ink-600">These examples map to joins, aggregations, rankings, and hierarchy traversal DataMind can perform against the employee schema.</p></div></Reveal><div className="mt-16 grid gap-px overflow-hidden border border-ink-800 bg-ink-800 sm:grid-cols-2 lg:grid-cols-3">{EXAMPLES.map((ex,index)=>{const locked=ex.adminOnly&&role==="member";return <Reveal key={ex.title} delay={index*55}><button type="button" disabled={locked} onClick={()=>onSelect(ex.q)} className="group flex min-h-[235px] w-full flex-col items-start bg-ink-950 p-7 text-left transition-all duration-500 hover:-translate-y-1 hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-45"><div className="flex w-full items-center justify-between gap-4"><span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-400">{ex.category}</span>{locked?<span className="text-[9px] uppercase tracking-[0.16em] text-ink-600">Admin scope</span>:<span className="text-ink-700 transition-all duration-300 group-hover:translate-x-1 group-hover:text-accent-400">↗</span>}</div><h3 className="mt-8 font-display text-xl text-ink-100 transition-transform duration-500 group-hover:translate-x-1">{ex.title}</h3><p className="mt-3 text-sm leading-6 text-ink-500">{ex.body}</p><span className="mt-auto pt-7 text-xs leading-5 text-ink-400">“{ex.q}”</span><span className="mt-4 h-px w-0 bg-accent-400 transition-all duration-700 group-hover:w-full"/></button></Reveal>})}</div></div></section>;
}
