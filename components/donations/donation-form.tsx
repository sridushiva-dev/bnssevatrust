"use client";

import { FundType, PaymentMethod } from "@prisma/client";
import Image from "next/image";
import { useState, useTransition } from "react";

import { createDonationAction } from "@/app/donations/actions";
import { lookupDonorByPhoneAction } from "@/app/donors/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DonationForm() {
  const [donorId, setDonorId] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [fundType, setFundType] = useState<FundType>(FundType.GENERAL_VOLUNTARY);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [corpusConfirmed, setCorpusConfirmed] = useState(false);
  const [corpusNote, setCorpusNote] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function lookupDonor() {
    startTransition(async () => {
      const res = await lookupDonorByPhoneAction(phone);
      if (res.success && res.data) {
        setDonorId(res.data.id);
        setMessage(`Donor: ${res.data.fullName} (${res.data.donorCode})`);
      } else {
        setMessage("Donor not found — save donor in CRM first");
        setDonorId("");
      }
    });
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      if (paymentMethod === PaymentMethod.UPI_QR) {
        const res = await fetch("/api/donations/razorpay-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            donorId,
            amount,
            fundType,
            corpusDirectionConfirmed: corpusConfirmed,
            corpusDirectionNote: corpusNote,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setMessage(json.error ?? "QR failed");
          return;
        }
        setQrImageUrl(json.data.qrImageUrl);
        setMessage(`Pending UPI — ${json.data.receiptNumber}`);
        return;
      }

      if (paymentMethod === PaymentMethod.SUBSCRIPTION) {
        const res = await fetch("/api/donations/razorpay-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            donorId,
            planAmount: amount,
            frequency: "MONTHLY",
            fundType,
          }),
        });
        const json = await res.json();
        setMessage(
          json.success
            ? `Subscription link: ${json.data.shortUrl}`
            : json.error ?? "Subscription failed",
        );
        return;
      }

      const res = await createDonationAction({
        donorId,
        amount,
        fundType,
        paymentMethod,
        corpusDirectionConfirmed: corpusConfirmed,
        corpusDirectionNote: corpusNote,
        chequeNumber,
        chequeDate,
        chequeBankName: chequeBank,
      });
      if (res.success) {
        setMessage(
          `Receipt ${res.receiptNumber}${res.receiptPdfUrl ? ` — PDF ready` : ""}`,
        );
      } else {
        setMessage(res.error ?? "Failed");
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label>Donor phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <Button type="button" variant="outline" onClick={lookupDonor} disabled={pending}>
          Lookup
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Amount (INR)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </div>
        <div className="space-y-2">
          <Label>Fund type</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={fundType}
            onChange={(e) => setFundType(e.target.value as FundType)}
          >
            {Object.values(FundType).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Payment method</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            {Object.values(PaymentMethod).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {fundType === FundType.CORPUS_11_1_D && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={corpusConfirmed}
              onChange={(e) => setCorpusConfirmed(e.target.checked)}
            />
            Donor written direction toward Corpus (Sec 11(1)(d)) confirmed
          </label>
          <Input
            placeholder="Direction note / deed reference"
            value={corpusNote}
            onChange={(e) => setCorpusNote(e.target.value)}
          />
          <Input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="text-xs"
          />
        </div>
      )}

      {paymentMethod === PaymentMethod.CHEQUE && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cheque number</Label>
            <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cheque date</Label>
            <Input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Bank name</Label>
            <Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Cheque scan</Label>
            <Input type="file" accept="image/*,application/pdf" capture="environment" />
          </div>
        </div>
      )}

      {qrImageUrl && (
        <div className="flex flex-col items-center gap-2">
          <Image src={qrImageUrl} alt="UPI QR" width={240} height={240} unoptimized />
          <p className="text-xs text-muted-foreground">Scan to pay — receipt on webhook capture</p>
        </div>
      )}

      {message && <p className="text-sm">{message}</p>}

      <Button
        type="button"
        className="w-full"
        disabled={pending || !donorId}
        onClick={submit}
      >
        Record donation
      </Button>
    </div>
  );
}
