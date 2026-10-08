export interface ValidationIssue {
  message: string;
  path: string;
}

export interface StructuredHttpError extends Error {
  issues?: ValidationIssue[];
}

export function fieldError(error: unknown, path: string): string | undefined {
  if (!(error instanceof Error) || !('issues' in error)) return undefined;
  const issues = (error as StructuredHttpError).issues;
  return issues?.find((issue) => issue.path === path)?.message;
}

export function formError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
