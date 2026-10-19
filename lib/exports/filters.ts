import { parseFinancialYearLabel } from "@/lib/utils/financialYear";

import type { ExportFilter } from "./types";

export function parseExportFilterFromQuery(params: {
  fy?: string | null;
  from?: string | null;
  to?: string | null;
}): ExportFilter {
  const financialYear = params.fy?.trim() || undefined;
  let dateFrom = params.from ? new Date(params.from) : undefined;
  let dateTo = params.to ? new Date(params.to) : undefined;

  if (financialYear && !dateFrom && !dateTo) {
    const bounds = parseFinancialYearLabel(financialYear);
    dateFrom = bounds.startDate;
    dateTo = bounds.endDate;
  }

  if (dateTo) {
    dateTo.setHours(23, 59, 59, 999);
  }

  return { financialYear, dateFrom, dateTo };
}

export function journalEntryWhere(filter: ExportFilter) {
  const where: {
    financialYear?: string;
    entryDate?: { gte?: Date; lte?: Date };
  } = {};

  if (filter.financialYear) {
    where.financialYear = filter.financialYear;
  }
  if (filter.dateFrom || filter.dateTo) {
    where.entryDate = {};
    if (filter.dateFrom) where.entryDate.gte = filter.dateFrom;
    if (filter.dateTo) where.entryDate.lte = filter.dateTo;
  }

  return where;
}

export function donationWhere(filter: ExportFilter) {
  const where: {
    financialYear?: string;
    createdAt?: { gte?: Date; lte?: Date };
    status?: "REALIZED";
  } = { status: "REALIZED" };

  if (filter.financialYear) where.financialYear = filter.financialYear;
  if (filter.dateFrom || filter.dateTo) {
    where.createdAt = {};
    if (filter.dateFrom) where.createdAt.gte = filter.dateFrom;
    if (filter.dateTo) where.createdAt.lte = filter.dateTo;
  }
  return where;
}

export function expenseWhere(filter: ExportFilter) {
  const where: {
    financialYear?: string;
    expenseDate?: { gte?: Date; lte?: Date };
    status?: "REALIZED";
  } = { status: "REALIZED" };

  if (filter.financialYear) where.financialYear = filter.financialYear;
  if (filter.dateFrom || filter.dateTo) {
    where.expenseDate = {};
    if (filter.dateFrom) where.expenseDate.gte = filter.dateFrom;
    if (filter.dateTo) where.expenseDate.lte = filter.dateTo;
  }
  return where;
}
