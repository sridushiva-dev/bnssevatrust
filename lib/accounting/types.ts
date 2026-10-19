export type ActionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  complianceWarnings?: string[];
};
