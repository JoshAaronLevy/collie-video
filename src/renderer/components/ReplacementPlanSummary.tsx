import type { ReactElement } from 'react';
import type { ReplacementPlan } from '../../shared/types/replacementWorkflow';

interface ReplacementPlanSummaryProps {
  plan: ReplacementPlan;
}

export function ReplacementPlanSummary({ plan }: ReplacementPlanSummaryProps): ReactElement {
  return (
    <section className="replacement-summary-grid" aria-label="Replacement plan summary">
      <SummaryMetric label="Converted" value={plan.summary.total.toLocaleString()} />
      <SummaryMetric label="Ready" value={plan.summary.ready.toLocaleString()} />
      <SummaryMetric label="Warnings" value={plan.summary.warning.toLocaleString()} />
      <SummaryMetric label="Blocked" value={plan.summary.blocked.toLocaleString()} />
      <SummaryMetric label="Original size" value={formatBytes(plan.summary.totalOriginalSizeBytes)} />
      <SummaryMetric label="Output size" value={formatBytes(plan.summary.totalOutputSizeBytes)} />
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  return `${bytes.toLocaleString()} B`;
}
