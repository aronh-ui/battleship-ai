import { useEffect, useState } from 'react';
import type { AiThought } from '../engine/ai';
import type { Difficulty } from '../engine/types';

export interface CommandVerdict {
  /** Coordinate label of the AI's last shot, e.g. "C7". */
  coord: string;
  outcome: 'miss' | 'hit' | 'sunk';
  target?: string;
  reason?: string;
}

interface AiCommandCenterProps {
  active: boolean;
  difficulty: Difficulty;
  plan: AiThought[];
  verdict: CommandVerdict | null;
  /** Delay between reasoning steps, matched to the AI's thinking pause. */
  stepMs: number;
}

const STAGE_LABEL: Record<string, string> = {
  observe: 'Observe',
  reason: 'Reason',
  act: 'Act',
  verify: 'Verify',
};

function verdictLine(verdict: CommandVerdict): { label: string; detail: string } {
  if (verdict.outcome === 'sunk') {
    return {
      label: `${verdict.target ?? 'Target'} destroyed`,
      detail: `${verdict.coord} confirmed sunk — returning to search pattern`,
    };
  }
  if (verdict.outcome === 'hit') {
    return {
      label: 'Impact confirmed',
      detail: `${verdict.coord} hit — hull damaged, tracking continues`,
    };
  }
  return { label: 'No contact', detail: `${verdict.coord} clear — updating the map` };
}

export function AiCommandCenter({
  active,
  difficulty,
  plan,
  verdict,
  stepMs,
}: AiCommandCenterProps) {
  // The parent remounts this panel each AI turn, so the reveal starts fresh.
  const [visible, setVisible] = useState(active ? 1 : plan.length);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setVisible((n) => Math.min(n + 1, plan.length));
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [active, plan.length, stepMs]);

  const steps: AiThought[] = plan.slice(0, active ? visible : plan.length);

  const showVerdict = !active && verdict !== null;
  const verdictText = verdict ? verdictLine(verdict) : null;

  return (
    <section
      aria-label="AI command center"
      data-testid="command-center"
      className="rounded-lg border border-cyan-500/30 bg-sea-800/70 p-3"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">
          AI Command Center
        </h3>
        <span
          data-testid="command-status"
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-wide ${
            active ? 'text-amber-300' : 'text-slate-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              active ? 'animate-ping-slow bg-amber-300' : 'bg-slate-500'
            }`}
          />
          {active ? 'Engaged' : 'Standing by'}
        </span>
      </header>

      <ol className="space-y-1.5">
        {steps.map((step, index) => (
          <li
            key={`${step.stage}-${index}`}
            className={`animate-slide-in rounded border-l-2 pl-2 ${
              index === steps.length - 1 && active
                ? 'border-cyan-400 text-slate-100'
                : 'border-sea-600 text-slate-400'
            }`}
          >
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-cyan-400/70">
              {STAGE_LABEL[step.stage]}
            </p>
            <p className="text-xs font-medium">{step.label}</p>
            <p className="text-[0.68rem] leading-snug text-slate-400">{step.detail}</p>
          </li>
        ))}

        {showVerdict && verdictText && (
          <li
            className={`animate-slide-in rounded border-l-2 pl-2 ${
              verdict.outcome === 'miss'
                ? 'border-slate-500 text-slate-300'
                : 'border-rose-400 text-rose-200'
            }`}
          >
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-cyan-400/70">
              {STAGE_LABEL.verify}
            </p>
            <p className="text-xs font-medium">{verdictText.label}</p>
            <p className="text-[0.68rem] leading-snug text-slate-400">
              {verdictText.detail}
            </p>
          </li>
        )}
      </ol>

      {active && (
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded bg-sea-700">
          <div className="h-full w-1/3 animate-scan bg-cyan-400/80" />
        </div>
      )}

      <p className="mt-2 border-t border-sea-700 pt-2 text-[0.65rem] leading-snug text-slate-400">
        {difficulty === 'smart'
          ? 'Smart mode: searches on a checkerboard, then locks onto a hull once it lands a hit.'
          : 'Easy mode: fires at a random untried cell and forgets what it learned.'}
      </p>
    </section>
  );
}
