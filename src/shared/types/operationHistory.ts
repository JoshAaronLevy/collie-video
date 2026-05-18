import type {
  FileIdentity,
  FileOperationExecutionStatus,
  FileOperationPlan,
  FileOperationResult,
  FileOperationResultItem,
  FileOperationType
} from './fileOperations';

export type OperationHistoryStatus =
  | FileOperationExecutionStatus
  | 'complete-with-failures'
  | 'canceled';

export interface OperationHistorySummary {
  totalItems: number;
  succeededItems: number;
  skippedItems: number;
  failedItems: number;
  totalSizeBytes: number;
}

export interface OperationHistoryItemRecord extends FileOperationResultItem {
  sourceBefore?: FileIdentity | null;
  sourceAfter?: FileIdentity | null;
  destinationAfter?: FileIdentity | null;
}

export interface OperationHistoryRecord {
  id: string;
  planId: string;
  type: FileOperationType;
  status: OperationHistoryStatus;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  summary: OperationHistorySummary;
  planSnapshot: FileOperationPlan;
  resultSnapshot?: FileOperationResult | null;
  items: OperationHistoryItemRecord[];
  logPath?: string | null;
}

export interface OperationHistoryListResponse {
  status: 'success' | 'error';
  records: OperationHistoryRecord[];
  message?: string;
}

export interface OperationHistoryDetailsResponse {
  status: 'success' | 'not_found' | 'error';
  record?: OperationHistoryRecord;
  message?: string;
}
