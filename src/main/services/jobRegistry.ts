import { randomUUID } from 'node:crypto';

export interface JobRecord<TRequest, TSnapshot, TResult> {
  id: string;
  request: TRequest;
  abortController: AbortController;
  snapshot: TSnapshot;
  result: TResult | null;
}

export class JobRegistry<TRequest, TSnapshot, TResult> {
  private readonly jobs = new Map<string, JobRecord<TRequest, TSnapshot, TResult>>();

  create(request: TRequest, snapshot: Omit<TSnapshot, 'jobId'> & { jobId?: string | null }): JobRecord<TRequest, TSnapshot, TResult> {
    const id = randomUUID();
    const job = {
      id,
      request,
      abortController: new AbortController(),
      snapshot: {
        ...snapshot,
        jobId: id
      } as TSnapshot,
      result: null
    };

    this.jobs.set(id, job);
    return job;
  }

  get(id: string): JobRecord<TRequest, TSnapshot, TResult> | null {
    return this.jobs.get(id) ?? null;
  }

  setSnapshot(job: JobRecord<TRequest, TSnapshot, TResult>, snapshot: TSnapshot): TSnapshot {
    job.snapshot = snapshot;
    return job.snapshot;
  }

  patchSnapshot(
    job: JobRecord<TRequest, TSnapshot, TResult>,
    patch: Partial<TSnapshot>
  ): TSnapshot {
    job.snapshot = {
      ...job.snapshot,
      ...patch
    };
    return job.snapshot;
  }

  setResult(job: JobRecord<TRequest, TSnapshot, TResult>, result: TResult): TResult {
    job.result = result;
    return job.result;
  }
}
