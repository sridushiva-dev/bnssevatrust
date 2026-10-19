export function escapeCsvField(value: string | null | undefined): string {
  const v = value ?? "";
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function toCsvRow(values: Array<string | null | undefined>): string {
  return values.map(escapeCsvField).join(",");
}
