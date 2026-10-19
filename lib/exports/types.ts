export type ExportFilter = {
  financialYear?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type GeneratedFile = {
  fileName: string;
  content: string;
  mimeType: string;
};
