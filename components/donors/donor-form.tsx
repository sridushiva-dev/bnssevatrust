"use client";

import { useState, useTransition } from "react";

import { lookupDonorByPhoneAction, upsertDonorAction } from "@/app/donors/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initial?: Partial<{
    fullName: string;
    phone: string;
    email: string;
    panNumber: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pinCode: string;
  }>;
};

export function DonorForm({ initial }: Props) {
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    panNumber: initial?.panNumber ?? "",
    addressLine1: initial?.addressLine1 ?? "",
    addressLine2: initial?.addressLine2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "Tamil Nadu",
    pinCode: initial?.pinCode ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function lookupPhone() {
    startTransition(async () => {
      const res = await lookupDonorByPhoneAction(form.phone);
      if (res.success && res.data) {
        setForm({
          fullName: res.data.fullName,
          phone: res.data.phone,
          email: res.data.email ?? "",
          panNumber: res.data.panNumber ?? "",
          addressLine1: res.data.addressLine1,
          addressLine2: res.data.addressLine2 ?? "",
          city: res.data.city,
          state: res.data.state,
          pinCode: res.data.pinCode,
        });
        setMessage(`Loaded donor ${res.data.donorCode}`);
      } else if (res.success) {
        setMessage("No existing donor — create new profile");
      }
    });
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await upsertDonorAction(form);
      setMessage(res.success ? "Donor saved" : res.error ?? "Failed");
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="phone">Phone (lookup key)</Label>
          <Input
            id="phone"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => patch("phone", e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" onClick={lookupPhone} disabled={pending}>
          Auto-fill
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => patch("fullName", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pan">PAN</Label>
          <Input
            id="pan"
            className="uppercase"
            value={form.panNumber}
            onChange={(e) => patch("panNumber", e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => patch("email", e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Address line 1</Label>
          <Input
            id="address"
            value={form.addressLine1}
            onChange={(e) => patch("addressLine1", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" value={form.city} onChange={(e) => patch("city", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin">PIN code</Label>
          <Input
            id="pin"
            inputMode="numeric"
            value={form.pinCode}
            onChange={(e) => patch("pinCode", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" value={form.state} onChange={(e) => patch("state", e.target.value)} />
        </div>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <Button type="button" className="w-full" disabled={pending} onClick={submit}>
        Save donor
      </Button>
    </div>
  );
}
