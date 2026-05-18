import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Gauge,
  GitBranch,
  KeyRound,
  ShieldCheck,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react';

const lifecycle = [
  { label: 'Created', detail: 'Requester defines objective, budget, complexity, and expiry.' },
  { label: 'Accepted', detail: 'Agent accepts under a mandate with per-task and daily limits.' },
  { label: 'Funded', detail: 'Escrow reserves payment while the task is in progress.' },
  { label: 'Completed', detail: 'Outcome is submitted with metadata for review.' },
  { label: 'Released', detail: 'Funds release and reputation metadata updates.' },
];

const tasks = [
  {
    title: 'Summarize supplier risk report',
    status: 'In progress',
    agent: 'risk-reader/v2',
    budget: '$240.00',
    limit: '$300 single-task cap',
    score: 91,
  },
  {
    title: 'Monitor invoice anomaly queue',
    status: 'Accepted',
    agent: 'ops-monitor/v1',
    budget: '$120.00',
    limit: '$500 daily cap',
    score: 86,
  },
  {
    title: 'Classify support escalations',
    status: 'Disputed',
    agent: 'triage-agent/v3',
    budget: '$75.00',
    limit: '$100 single-task cap',
    score: 68,
  },
];

const events = [
  ['09:14', 'task.created', 'Requester opened a $240 task with L2 complexity.'],
  ['09:16', 'mandate.checked', 'risk-reader/v2 passed spending and expiry checks.'],
  ['09:17', 'escrow.funded', 'Payment reserved while the task remains active.'],
  ['10:02', 'task.completed', 'Agent submitted output package and trace metadata.'],
  ['10:08', 'reputation.updated', 'Reliability score increased from 90 to 91.'],
];

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border/60 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-2 text-primary">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
                agent-payment-workflows
              </p>
              <h1 className="text-xl font-semibold">Agent Payment Workflow Demo</h1>
            </div>
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted-foreground md:flex">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Static demo data, no wallet required
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
              <GitBranch className="h-4 w-4" />
              Task lifecycle, escrow state, mandates, pricing, reputation
            </div>
            <h2 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
              Transaction workflows for autonomous agents
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              This sandbox models the control plane around agent-operated work:
              who authorized the agent, what limits applied, how payment was
              reserved, which state transitions happened, and how reliability
              changed after the outcome.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Metric icon={Activity} label="Active tasks" value="18" />
              <Metric icon={CircleDollarSign} label="Reserved escrow" value="$7.4K" />
              <Metric icon={Gauge} label="Avg. reliability" value="88.6" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                  Pricing policy
                </p>
                <h3 className="mt-1 text-2xl font-semibold">$240.00 quote</h3>
              </div>
              <BadgeDollarSign className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-4">
              <PolicyRow label="Base fee" value="$200.00" />
              <PolicyRow label="Reputation factor" value="0.90x" />
              <PolicyRow label="Complexity factor" value="1.50x" />
              <PolicyRow label="Demand factor" value="0.89x" />
              <div className="border-t border-border pt-4">
                <PolicyRow label="Insurance reserve" value="$18.00" strong />
              </div>
            </div>
            <div className="mt-6 rounded-xl bg-primary/10 p-4 text-sm text-primary">
              Price is policy output, not a magic number: every factor is visible
              for review before the agent accepts work.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="rounded-2xl border border-border bg-card/50 p-6">
          <div className="mb-6 flex items-center gap-3">
            <FileCheck2 className="h-6 w-6 text-primary" />
            <h3 className="text-2xl font-semibold">Lifecycle Example</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-5">
            {lifecycle.map((step, index) => (
              <div key={step.label} className="relative rounded-xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  {index < lifecycle.length - 1 && (
                    <ArrowRight className="hidden h-5 w-5 text-muted-foreground md:block" />
                  )}
                </div>
                <h4 className="font-semibold">{step.label}</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card/50 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-2xl font-semibold">Workflow Queue</h3>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
              3 reviewable tasks
            </span>
          </div>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.title} className="rounded-xl border border-border bg-background/70 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold">{task.title}</h4>
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                        {task.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {task.agent} · {task.limit}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm md:min-w-[220px]">
                    <div>
                      <p className="text-muted-foreground">Escrow</p>
                      <p className="font-semibold">{task.budget}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reliability</p>
                      <p className="font-semibold">{task.score}/100</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-6">
          <h3 className="mb-6 text-2xl font-semibold">Audit Trail</h3>
          <div className="space-y-4">
            {events.map(([time, name, detail]) => (
              <div key={`${time}-${name}`} className="flex gap-3">
                <div className="pt-1">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-mono text-sm text-primary">{time} · {name}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-12 md:grid-cols-3">
        <Capability icon={KeyRound} title="Mandates" text="Limit what an agent can spend before it accepts a task." />
        <Capability icon={WalletCards} title="Escrow State" text="Track reserved, released, refunded, and disputed funds." />
        <Capability icon={UserRoundCheck} title="Reliability" text="Attach outcome metadata to humans and agents." />
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function PolicyRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'text-lg font-bold text-primary' : 'font-semibold'}>{value}</span>
    </div>
  );
}

function Capability({ icon: Icon, title, text }: { icon: typeof KeyRound; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-6">
      <Icon className="mb-4 h-7 w-7 text-primary" />
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-3 leading-7 text-muted-foreground">{text}</p>
    </div>
  );
}
