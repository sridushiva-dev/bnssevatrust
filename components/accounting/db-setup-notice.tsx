export function DbSetupNotice() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Database not connected</p>
      <p className="mt-2">
        Set <code className="text-foreground">DATABASE_URL</code> in{" "}
        <code className="text-foreground">.env</code>, then run{" "}
        <code className="text-foreground">npm run db:push</code> and{" "}
        <code className="text-foreground">npm run db:seed</code> to load reports
        and ledger drill-down.
      </p>
    </div>
  );
}
