"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = {
  initialized: boolean;
  userCount: number;
  ledgerCount: number;
  databaseReachable?: boolean;
};

export default function SetupPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/setup/status");
    const json = await res.json();
    if (json.success) setStatus(json.data);
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function runSeed() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/setup/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const json = await res.json();
      if (!json.success) {
        setMessage(json.error ?? "Setup failed");
      } else {
        setMessage(json.data.message);
        await refreshStatus();
      }
    } catch {
      setMessage("Network error — check deployment logs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Cloud database setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No terminal required. After Vercel deploys with{" "}
          <code className="text-xs">DATABASE_URL</code> and{" "}
          <code className="text-xs">SETUP_SECRET</code>, run the one-time seed here.
        </p>
      </div>

      {status && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p>
            Database:{" "}
            {status.databaseReachable === false
              ? "Not reachable yet (tables may still be creating on first deploy)"
              : status.initialized
                ? "Ready"
                : "Empty — seed required"}
          </p>
          <p className="text-muted-foreground">
            Users: {status.userCount} · Ledgers: {status.ledgerCount}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="secret">Setup secret</Label>
        <Input
          id="secret"
          type="password"
          autoComplete="off"
          placeholder="Same value as SETUP_SECRET in Vercel"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
      </div>

      <Button type="button" disabled={loading || !secret} onClick={() => void runSeed()}>
        {loading ? "Seeding…" : "Initialize database (seed)"}
      </Button>

      {message && <p className="text-sm">{message}</p>}

      {status?.initialized && (
        <Button asChild>
          <Link href="/">Open trust portal</Link>
        </Button>
      )}
    </div>
  );
}
