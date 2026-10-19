/**
 * Indian Financial Year utilities (1 April – 31 March).
 * FY label format: "2026-27" for AY spanning Apr 2026 – Mar 2027.
 */

const FY_LABEL_REGEX = /^(\d{4})-(\d{2})$/;

export type FinancialYearBounds = {
  label: string;
  startDate: Date;
  endDate: Date;
};

/** UTC-safe calendar parts for a Date (local wall-clock components). */
function getLocalParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/**
 * Returns the Indian FY label for a given date.
 * Example: 2026-08-15 → "2026-27", 2027-01-10 → "2026-27".
 */
export function getFinancialYearLabel(date: Date = new Date()): string {
  const { year, month } = getLocalParts(date);
  if (month >= 4) {
    const endTwo = String((year + 1) % 100).padStart(2, "0");
    return `${year}-${endTwo}`;
  }
  const startYear = year - 1;
  const endTwo = String(year % 100).padStart(2, "0");
  return `${startYear}-${endTwo}`;
}

/** Parse "2026-27" into inclusive FY start/end instants (local midnight / end-of-day). */
export function parseFinancialYearLabel(label: string): FinancialYearBounds {
  const match = FY_LABEL_REGEX.exec(label);
  if (!match) {
    throw new Error(`Invalid financial year label: ${label}`);
  }
  const startYear = Number.parseInt(match[1], 10);
  const endTwo = Number.parseInt(match[2], 10);
  const expectedEndTwo = (startYear + 1) % 100;
  if (endTwo !== expectedEndTwo) {
    throw new Error(`Financial year label mismatch: ${label}`);
  }
  const startDate = new Date(startYear, 3, 1, 0, 0, 0, 0);
  const endDate = new Date(startYear + 1, 2, 31, 23, 59, 59, 999);
  return { label, startDate, endDate };
}

export function isDateInFinancialYear(date: Date, financialYear: string): boolean {
  const { startDate, endDate } = parseFinancialYearLabel(financialYear);
  return date >= startDate && date <= endDate;
}

/** Assessment Year (AY) is the calendar year in which the FY ends (Mar 31). */
export function getAssessmentYearLabel(financialYear: string): string {
  const { endDate } = parseFinancialYearLabel(financialYear);
  return String(endDate.getFullYear());
}
