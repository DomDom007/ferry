// Ferry: a 30-day onboarding path that spreads coffee chats and first tasks across the first month, with calendar export.
import { useMemo, useState } from "react";
import { downloadIcs, localDate } from "./lib/ics";
import { download, uid, useStored } from "./lib/store";
import { addDays, prettyDate } from "./lib/time";
import { Section, Stat, Stats } from "./ui/kit";

const T = "ferry";
type Person = { id: string; name: string; role: string; closeness: 1 | 2 | 3; why: string };
type Task = { id: string; title: string; week: 1 | 2 | 3 | 4 };
const PEOPLE: Person[] = [
  { id: "p1", name: "Sami", role: "Manager", closeness: 1, why: "Expectations for the first 90 days" },
  { id: "p2", name: "Ines", role: "Teammate", closeness: 1, why: "How the team works day to day" },
  { id: "p3", name: "Walid", role: "Teammate", closeness: 1, why: "The codebase and deploy process" },
  { id: "p4", name: "Rania", role: "Product manager", closeness: 2, why: "Roadmap and how priorities are set" },
  { id: "p5", name: "Hedi", role: "Customer support lead", closeness: 2, why: "What customers complain about most" },
  { id: "p6", name: "Olfa", role: "Sales", closeness: 3, why: "What customers say before they buy" },
  { id: "p7", name: "Aziz", role: "Finance", closeness: 3, why: "Expenses, budgets and tools" },
];
const TASKS: Task[] = [
  { id: "t1", title: "Laptop, accounts and access set up", week: 1 }, { id: "t2", title: "Read the last three product updates", week: 1 },
  { id: "t3", title: "Ship a first small fix", week: 2 }, { id: "t4", title: "Sit in on five support calls", week: 2 },
  { id: "t5", title: "Own a small feature end to end", week: 3 }, { id: "t6", title: "Write down three things that confused you", week: 4 },
  { id: "t7", title: "30-day check-in with your manager", week: 4 },
];

/** Workdays from start, skipping Saturday and Sunday. */
function workdays(start: string, n: number) {
  const out: string[] = []; let d = start;
  while (out.length < n) { const w = new Date(d + "T12:00:00Z").getUTCDay(); if (w !== 0 && w !== 6) out.push(d); d = addDays(d, 1); }
  return out;
}

export default function Ferry() {
  const [hire, setHire] = useStored(T, "hire", { name: "Lina", role: "Software engineer", start: addDays(new Date().toISOString().slice(0, 10), 7), perDay: 1, time: "11:00" });
  const [people, setPeople] = useStored<Person[]>(T, "people", PEOPLE);
  const [tasks, setTasks] = useStored<Task[]>(T, "tasks", TASKS);
  const [done, setDone] = useStored<string[]>(T, "done", []);
  const [np, setNp] = useState<{ name: string; role: string; closeness: 1 | 2 | 3; why: string }>({ name: "", role: "", closeness: 2, why: "" });

  // Closest people first, never more than `perDay` chats a day, and nothing on day one.
  const plan = useMemo(() => {
    const days = workdays(hire.start, 22);
    const order = [...people].sort((a, b) => a.closeness - b.closeness);
    const chats = order.map((p, i) => ({ p, date: days[Math.min(days.length - 1, 1 + Math.floor(i / Math.max(1, hire.perDay)) * (p.closeness === 3 ? 2 : 1))] }));
    const byWeek = [1, 2, 3, 4].map(w => ({ w, from: days[(w - 1) * 5], chats: chats.filter(c => c.date >= days[(w - 1) * 5] && (w === 4 || c.date < days[w * 5])), tasks: tasks.filter(t => t.week === w) }));
    return { chats, byWeek };
  }, [people, tasks, hire]);

  const progress = done.length / Math.max(1, plan.chats.length + tasks.length);
  const exportIcs = () => downloadIcs(`onboarding-${hire.name.toLowerCase()}.ics`, [
    ...plan.chats.map(c => ({ title: `Coffee chat: ${hire.name} and ${c.p.name}`, start: localDate(c.date, hire.time), end: new Date(localDate(c.date, hire.time).getTime() + 30 * 60000), description: `${c.p.role}. Talk about: ${c.p.why}` })),
    ...tasks.map(t => ({ title: `Onboarding: ${t.title}`, start: localDate(plan.byWeek[t.week - 1].from), allDay: true })),
  ], `${hire.name}'s first month`);
  const toggle = (id: string) => setDone(done.includes(id) ? done.filter(x => x !== id) : [...done, id]);
  const intro = () => plan.chats.map(c => `${prettyDate(c.date)} ${hire.time}: ${c.p.name} (${c.p.role}), about ${c.p.why.toLowerCase()}`).join("\n");

  return (
    <div className="stack">
      <Section title={`${hire.name}'s first month`} aside={<><button className="btn small primary" onClick={exportIcs}>Add all to calendar</button><button className="btn small" onClick={() => download("coffee-chats.txt", intro(), "text/plain")}>Chat list</button></>}>
        <Stats><Stat value={plan.chats.length} label="Coffee chats" /><Stat value={tasks.length} label="First tasks" /><Stat value={`${Math.round(progress * 100)}%`} label="Done" tone={progress === 1 ? "good" : undefined} /></Stats>
        <div className="row" style={{ marginTop: 16 }}>
          <label className="field"><span>New hire</span><input id="fe-name" className="input" value={hire.name} onChange={e => setHire({ ...hire, name: e.target.value })} /></label>
          <label className="field"><span>Role</span><input id="fe-role" className="input" value={hire.role} onChange={e => setHire({ ...hire, role: e.target.value })} /></label>
          <label className="field"><span>Start date</span><input id="fe-start" type="date" className="input" value={hire.start} onChange={e => setHire({ ...hire, start: e.target.value })} /></label>
          <label className="field"><span>Chats per day</span><select id="fe-per" className="input" value={hire.perDay} onChange={e => setHire({ ...hire, perDay: +e.target.value })}>{[1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></label>
          <label className="field"><span>Chat time</span><input id="fe-time" type="time" className="input" value={hire.time} onChange={e => setHire({ ...hire, time: e.target.value })} /></label>
        </div>
      </Section>

      <div className="fe-weeks">
        {plan.byWeek.map(w => (
          <section key={w.w} className="panel">
            <p className="eyebrow">Week {w.w} · from {prettyDate(w.from)}</p>
            <div className="stack" style={{ gap: 8, marginTop: 10 }}>
              {w.chats.map(c => (
                <label key={c.p.id} className="fe-item"><input type="checkbox" checked={done.includes(c.p.id)} onChange={() => toggle(c.p.id)} />
                  <span><strong>Coffee with {c.p.name}</strong> <span className="note">{c.p.role} · {prettyDate(c.date)}</span><br /><span className="note">{c.p.why}</span></span></label>
              ))}
              {w.tasks.map(t => (
                <label key={t.id} className="fe-item"><input type="checkbox" checked={done.includes(t.id)} onChange={() => toggle(t.id)} /><span>{t.title}</span></label>
              ))}
              {!w.chats.length && !w.tasks.length && <p className="note">Nothing planned.</p>}
            </div>
          </section>
        ))}
      </div>

      <div className="grid2">
        <Section title="People to meet">
          <div className="stack" style={{ gap: 6 }}>
            {people.map(p => (
              <div key={p.id} className="row" style={{ alignItems: "center" }}>
                <span style={{ flex: 1 }}><strong>{p.name}</strong> <span className="note">{p.role}</span></span>
                <select className="input" style={{ width: 150 }} aria-label="How close" value={p.closeness} onChange={e => setPeople(people.map(x => x.id === p.id ? { ...x, closeness: +e.target.value as 1 | 2 | 3 } : x))}><option value={1}>Same team</option><option value={2}>Works with often</option><option value={3}>Elsewhere</option></select>
                <button className="btn ghost small danger" onClick={() => setPeople(people.filter(x => x.id !== p.id))}>Remove</button>
              </div>
            ))}
          </div>
          <form className="stack" style={{ gap: 8, marginTop: 12 }} onSubmit={e => { e.preventDefault(); if (!np.name.trim()) return; setPeople([...people, { id: uid(), ...np, name: np.name.trim() }]); setNp({ name: "", role: "", closeness: 2, why: "" }); }}>
            <div className="row"><input id="fe-np" className="input" style={{ flex: 1 }} aria-label="Name" placeholder="Name" value={np.name} onChange={e => setNp({ ...np, name: e.target.value })} /><input className="input" style={{ flex: 1 }} aria-label="Role" placeholder="Role" value={np.role} onChange={e => setNp({ ...np, role: e.target.value })} /></div>
            <div className="row"><input className="input" style={{ flex: 2 }} aria-label="Talk about" placeholder="Talk about…" value={np.why} onChange={e => setNp({ ...np, why: e.target.value })} /><button className="btn small" type="submit">Add</button></div>
          </form>
        </Section>
        <Section title="First tasks">
          <div className="stack" style={{ gap: 6 }}>
            {tasks.map(t => (
              <div key={t.id} className="row" style={{ alignItems: "center" }}>
                <input className="input" style={{ flex: 1 }} aria-label="Task" value={t.title} onChange={e => setTasks(tasks.map(x => x.id === t.id ? { ...x, title: e.target.value } : x))} />
                <select className="input" style={{ width: 100 }} aria-label="Week" value={t.week} onChange={e => setTasks(tasks.map(x => x.id === t.id ? { ...x, week: +e.target.value as Task["week"] } : x))}>{[1, 2, 3, 4].map(w => <option key={w} value={w}>Week {w}</option>)}</select>
                <button className="btn ghost small danger" onClick={() => setTasks(tasks.filter(x => x.id !== t.id))}>Remove</button>
              </div>
            ))}
            <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => setTasks([...tasks, { id: uid(), title: "New task", week: 2 }])}>Add a task</button>
          </div>
        </Section>
      </div>
      <style>{`.fe-weeks{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.fe-item{display:flex;gap:10px;align-items:flex-start;cursor:pointer}.fe-item input{margin-top:4px;width:18px;height:18px;accent-color:var(--accent)}`}</style>
    </div>
  );
}
