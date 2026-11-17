// front/src/components/dashboard/Timeline.jsx
// Tab Aplikacija: ceo put kao jedna lista. Četiri koraka istim redom kao proces;
// otvoren je onaj koji je na redu, ostali se otvaraju klikom.
import { cx, CheckIcon } from "../ui";
import { TaskList, Chevron, taskTarget } from "./ui";

function Marker({ state, isCurrent }) {
  const base = "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full";
  if (state === "done")
    return (
      <span className={cx(base, "bg-ink text-white")}>
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  if (state === "danger") return <span className={cx(base, "bg-red-600 text-sm font-bold text-white")}>!</span>;
  if (state === "wait")
    return (
      <span className={cx(base, "border-2 border-amber-400 bg-white")}>
        <span className="h-2 w-2 rounded-full bg-amber-400" />
      </span>
    );
  if (isCurrent)
    return (
      <span className={cx(base, "bg-brand")}>
        <span className="h-2 w-2 rounded-full bg-ink" />
      </span>
    );
  return <span className={cx(base, "border border-line-strong bg-white")} />;
}

const NOTE_TONE = { done: "text-ink-3", wait: "text-amber-700", danger: "text-red-700", current: "text-ink-2", locked: "text-ink-3" };

export default function Timeline({ stages, currentId, openId, onToggle, goTo }) {
  return (
    <ol>
      {stages.map((s, i) => {
        const open = s.id === openId;
        const isCurrent = s.id === currentId;
        const locked = s.state === "locked";
        const doneCount = s.tasks.filter((t) => t.state === "done").length;
        const last = i === stages.length - 1;
        return (
          <li key={s.id} className="relative">
            {/* linija puta do sledećeg koraka */}
            {!last && (
              <span
                aria-hidden="true"
                className={cx("absolute -bottom-3 left-[13.5px] top-10 w-px", s.state === "done" ? "bg-ink" : "bg-line-strong")}
              />
            )}
            <button
              type="button"
              onClick={() => onToggle(open ? null : s.id)}
              aria-expanded={open}
              className="group flex w-full items-center gap-4 py-3 text-left"
            >
              <Marker state={s.state} isCurrent={isCurrent} />
              <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
                <span className="block w-24 shrink-0 font-sign text-[15px] font-semibold text-ink-3">{s.label}</span>
                <span className={cx("block truncate text-[17px] font-semibold", locked ? "text-ink-3" : "text-ink")}>{s.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {s.state === "done" ? (
                  <span className="hidden text-[13px] text-ink-3 sm:inline">{s.note}</span>
                ) : (
                  <>
                    {s.note && <span className={cx("hidden text-[13px] sm:inline", NOTE_TONE[s.state] || NOTE_TONE.current)}>{s.note}</span>}
                    {!locked && (
                      <span className="font-sign text-[15px] font-semibold text-ink">
                        {doneCount}/{s.tasks.length}
                      </span>
                    )}
                  </>
                )}
                <Chevron open={open} />
              </span>
            </button>
            {open && (
              <div className="pb-6 pl-11">
                {s.note && s.state !== "done" && (
                  <p className={cx("mb-3 text-[13px] sm:hidden", NOTE_TONE[s.state] || NOTE_TONE.current)}>{s.note}</p>
                )}
                <TaskList
                  tasks={s.tasks}
                  quiet={s.quiet || locked || s.done}
                  onNavigate={(t) => {
                    const [view, anchor] = taskTarget(t);
                    goTo(view, anchor, s.id);
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
