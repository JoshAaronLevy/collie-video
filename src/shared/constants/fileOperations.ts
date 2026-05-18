import type {
  FileOperationExecutionStatus,
  FileOperationPlanStatus,
  FileOperationType,
  FileOperationWarningCode,
  ReplacementFileAction
} from '../types/fileOperations';

export const FILE_OPERATION_TYPES = [
  'trash',
  'move',
  'copy',
  'archive',
  'replace-original-with-output'
] as const satisfies readonly FileOperationType[];

export const FILE_OPERATION_PLAN_STATUSES = [
  'ready',
  'warning',
  'blocked',
  'missing-source',
  'missing-output',
  'destination-conflict',
  'invalid-path',
  'unsupported-file',
  'would-overwrite'
] as const satisfies readonly FileOperationPlanStatus[];

export const FILE_OPERATION_EXECUTION_STATUSES = [
  'pending',
  'running',
  'success',
  'skipped',
  'failed'
] as const satisfies readonly FileOperationExecutionStatus[];

export const FILE_OPERATION_WARNING_CODES = [
  'stale-source-metadata',
  'stale-output-metadata',
  'destination-exists',
  'source-is-not-video',
  'source-outside-audit',
  'output-outside-managed-folder',
  'requires-user-confirmation',
  'partial-plan'
] as const satisfies readonly FileOperationWarningCode[];

export const REPLACEMENT_FILE_ACTIONS = [
  'skip',
  'keep-original',
  'trash-original',
  'archive-original',
  'replace-original-with-output',
  'move-output-to-source-directory'
] as const satisfies readonly ReplacementFileAction[];

export const RECOVERABLE_FILE_OPERATION_TYPES = [
  'trash',
  'move',
  'copy',
  'archive'
] as const satisfies readonly FileOperationType[];

export const USER_CONFIRMATION_REQUIRED_OPERATION_TYPES = [
  'trash',
  'move',
  'archive',
  'replace-original-with-output'
] as const satisfies readonly FileOperationType[];

export const FILE_OPERATION_SAFETY_PRINCIPLES = [
  'prefer-recoverable-operations',
  'plan-before-execute',
  'confirm-before-mutation',
  'validate-before-execute',
  'never-overwrite-by-default',
  'log-every-operation',
  'keep-items-independent'
] as const;

export const FILE_OPERATION_PROHIBITED_ACTIONS = [
  'permanent-delete',
  'delete-directory',
  'recursive-delete',
  'overwrite-without-confirmation',
  'renderer-filesystem-access'
] as const;
