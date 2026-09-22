"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  Table,
  Td,
  Textarea,
  Th,
  useToast,
} from "@/components/ui";

type ConsolePayload = {
  messages: {
    id: number;
    waMessageId: string;
    phone: string;
    direction: string;
    body: string | null;
    signatureVerified: boolean;
    handled: boolean;
    error: string | null;
    createdAt: string;
  }[];
  pending: {
    id: number;
    phone: string;
    action: string;
    summary: string;
    expiresAt: string;
    confirmedAt: string | null;
    executedAt: string | null;
    resultText: string | null;
  }[];
  identities: {
    phone: string | null;
    name: string;
    role: string;
    expiresAt: string;
    usedAt: string | null;
  }[];
  counts: { direction: string; count: number }[];
  config: { webhookConfigured: boolean; sendingConfigured: boolean; devBypass: boolean };
  env: { hasAppSecret: boolean; hasAccessToken: boolean; hasVerifyToken: boolean };
};

export function WhatsAppConsole() {
  const { push } = useToast();
  const [data, setData] = useState<ConsolePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("+919876500011");
  const [text, setText] = useState("2 kg potato");
  const [waMessageId, setWaMessageId] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("+919876500011");
  const [testText, setTestText] = useState("Test message from the FreshCut admin console.");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<ConsolePayload>("/api/admin/whatsapp");
      setData(result);
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not load WhatsApp console", "error");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  async function simulate(event: React.FormEvent) {
    event.preventDefault();
    setSimulating(true);
    setReply(null);
    try {
      const result = await apiFetch<{ duplicate: boolean; reply?: string; message?: string; waMessageId: string }>(
        "/api/whatsapp/simulate",
        {
          method: "POST",
          json: { from, text, waMessageId: waMessageId.trim() || undefined },
        },
      );
      setReply(result.duplicate ? `↺ Duplicate suppressed: ${result.message}` : (result.reply ?? ""));
      push(result.duplicate ? "Duplicate message id ignored (idempotent)" : "Message processed", "success");
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : "Simulation failed", "error");
    } finally {
      setSimulating(false);
    }
  }

  async function sendTest(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      const result = await apiFetch<{ result: { status: string; error?: string } }>("/api/admin/whatsapp", {
        method: "POST",
        json: { phone: testPhone, text: testText },
      });
      push(
        result.result.status === "SENT"
          ? "Message sent via WhatsApp Cloud API"
          : `Logged only (${result.result.status.toLowerCase()}): ${result.result.error ?? ""}`,
        result.result.status === "SENT" ? "success" : "info",
      );
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : "Send failed", "error");
    } finally {
      setSending(false);
    }
  }

  const inbound = data?.counts.find((c) => c.direction === "INBOUND")?.count ?? 0;
  const outbound = data?.counts.find((c) => c.direction === "OUTBOUND")?.count ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">WhatsApp</h1>
          <p className="text-sm text-neutral-600">
            Webhook security, message log, account linking and admin command queue.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} loading={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-[11px] font-semibold uppercase text-neutral-500">Inbound messages</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{inbound}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase text-neutral-500">Outbound messages</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{outbound}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase text-neutral-500">Signature verification</p>
          <p className="mt-1 text-sm">
            <Badge tone={data?.env.hasAppSecret ? "success" : "warn"}>
              {data?.env.hasAppSecret ? "WHATSAPP_APP_SECRET set" : "app secret missing"}
            </Badge>
          </p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase text-neutral-500">Outbound provider</p>
          <p className="mt-1 text-sm">
            <Badge tone={data?.config.sendingConfigured ? "success" : "warn"}>
              {data?.config.sendingConfigured ? "Cloud API connected" : "not configured (logged only)"}
            </Badge>
          </p>
        </Card>
      </div>

      <Alert tone="info" title="Webhook endpoint">
        <span className="block font-mono text-[11px]">
          POST /api/whatsapp/webhook — verifies X-Hub-Signature-256 (HMAC-SHA256 of the raw body, timing-safe) and
          enforces idempotency on the WhatsApp message id.
        </span>
        <span className="mt-1 block text-[11px]">
          Verify token configured: {data?.env.hasVerifyToken ? "yes" : "no"} • Dev bypass:{" "}
          {data?.config.devBypass ? "enabled" : "disabled"}
        </span>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <MessageCircle className="h-4 w-4 text-brand-600" /> Simulate an inbound message
          </h2>
          <p className="text-xs text-neutral-500">
            Runs the real webhook pipeline (idempotency + bot). Reuse a message id to prove duplicate suppression.
          </p>
          <form onSubmit={simulate} className="mt-3 space-y-3">
            <Field label="From (WhatsApp number)" htmlFor="sim-from" hint="Linked numbers use the customer account.">
              <Input id="sim-from" value={from} onChange={(event) => setFrom(event.target.value)} required />
            </Field>
            <Field label="Message" htmlFor="sim-text" hint="Try: 2 kg potato, show cart, checkout, order SW10001, low stock.">
              <Textarea id="sim-text" value={text} onChange={(event) => setText(event.target.value)} required />
            </Field>
            <Field label="Message id (optional)" htmlFor="sim-id" hint="Repeat the same id to test idempotency.">
              <Input
                id="sim-id"
                value={waMessageId}
                onChange={(event) => setWaMessageId(event.target.value)}
                placeholder="wamid.TEST-1"
              />
            </Field>
            <Button type="submit" loading={simulating}>
              <Send className="h-4 w-4" /> Process message
            </Button>
          </form>
          {reply ? (
            <div className="mt-3 whitespace-pre-wrap rounded-xl bg-brand-50/70 p-3 text-xs text-brand-900">{reply}</div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-base font-semibold text-ink">Send a WhatsApp message</h2>
            <form onSubmit={sendTest} className="mt-3 space-y-3">
              <Field label="Recipient" htmlFor="test-phone">
                <Input id="test-phone" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} />
              </Field>
              <Field label="Message" htmlFor="test-text">
                <Textarea id="test-text" value={testText} onChange={(event) => setTestText(event.target.value)} />
              </Field>
              <Button type="submit" variant="outline" loading={sending}>
                Send
              </Button>
            </form>
            <p className="mt-2 text-[11px] text-neutral-500">
              With no Cloud API credentials the message is stored with status SKIPPED so ordering flows are never
              blocked.
            </p>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-brand-600" /> Pending admin confirmations
            </h2>
            {loading ? (
              <LoadingRows rows={3} cols={2} />
            ) : (data?.pending.length ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-neutral-500">
                No pending actions. Sensitive commands (price/stock/status) wait here for CONFIRM.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-xs">
                {data?.pending.map((action) => (
                  <li key={action.id} className="rounded-xl border border-brand-100 p-2">
                    <p className="font-semibold text-ink">{action.action}</p>
                    <p className="whitespace-pre-line text-neutral-600">{action.summary}</p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {action.phone} • expires {formatDateTime(action.expiresAt)} •{" "}
                      {action.executedAt ? `executed: ${action.resultText}` : action.confirmedAt ? "confirmed" : "waiting"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-ink">Link codes issued</h2>
            {loading ? (
              <LoadingRows rows={3} cols={2} />
            ) : (data?.identities.length ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-neutral-500">
                No link codes generated yet. Customers generate one from Profile → Link WhatsApp.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                {data?.identities.map((identity, index) => (
                  <li key={`${identity.phone}-${index}`}>
                    {identity.phone ?? "unassigned"} • {identity.name} • {identity.usedAt ? "used" : "pending"} •
                    expires {formatDateTime(identity.expiresAt)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-ink">Message log</h2>
        <p className="text-xs text-neutral-500">
          Every inbound and outbound message is persisted with its WhatsApp message id.
        </p>
        <div className="pt-3">
          {loading ? (
            <LoadingRows rows={8} cols={5} />
          ) : (data?.messages.length ?? 0) === 0 ? (
            <EmptyState title="No WhatsApp traffic yet" description="Simulate a message above to see the pipeline." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Direction</Th>
                  <Th>Phone</Th>
                  <Th>Message</Th>
                  <Th>Signature</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data?.messages.map((message) => (
                  <tr key={message.id}>
                    <Td className="text-[11px] text-neutral-500">{formatDateTime(message.createdAt)}</Td>
                    <Td>
                      <Badge tone={message.direction === "INBOUND" ? "info" : "neutral"}>
                        {message.direction.toLowerCase()}
                      </Badge>
                    </Td>
                    <Td className="text-[12px]">{message.phone}</Td>
                    <Td className="max-w-80 truncate text-[12px]">{message.body ?? "—"}</Td>
                    <Td className="text-[11px]">
                      {message.direction === "OUTBOUND" ? "—" : message.signatureVerified ? "verified" : "dev"}
                    </Td>
                    <Td className="text-[11px]">
                      {message.error ? <span className="text-amber-700">{message.error}</span> : message.handled ? "handled" : "queued"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
