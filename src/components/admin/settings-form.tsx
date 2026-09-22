"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  LoadingRows,
  Table,
  Td,
  Textarea,
  Th,
  useToast,
} from "@/components/ui";

type Settings = {
  storeName: string;
  storePhone: string;
  whatsappNumber: string;
  supportEmail: string;
  minOrderValue: number;
  freeDeliveryThreshold: number;
  defaultDeliveryFee: number;
  taxPercent: number;
  openingTime: string;
  closingTime: string;
  codEnabled: boolean;
  notificationsEnabled: boolean;
  announcement: string;
};

type AuditEntry = {
  id: number;
  actorLabel: string;
  action: string;
  resource: string;
  resourceId: string | null;
  source: string;
  createdAt: string;
};

type Payload = {
  settings: Settings;
  audit: AuditEntry[];
  envStatus: { databaseUrlConfigured: boolean; whatsapp: { webhookConfigured: boolean; sendingConfigured: boolean; devBypass: boolean } };
};

export function SettingsForm() {
  const { push } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<Payload>("/api/admin/settings");
      setData(result);
      setForm(result.settings);
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not load settings", "error");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings", { method: "PUT", json: form });
      push("Store settings saved", "success");
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="space-y-4">
        <LoadingRows rows={6} cols={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Settings</h1>
        <p className="text-sm text-neutral-600">
          Store identity, delivery rules and notification switches. Secret credentials stay in environment
          variables only.
        </p>
      </header>

      <form onSubmit={save} className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-ink">Store profile</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Store name" htmlFor="storeName">
                <Input id="storeName" value={form.storeName} onChange={(event) => update("storeName", event.target.value)} />
              </Field>
              <Field label="Support email" htmlFor="supportEmail">
                <Input id="supportEmail" value={form.supportEmail} onChange={(event) => update("supportEmail", event.target.value)} />
              </Field>
              <Field label="Store phone" htmlFor="storePhone">
                <Input id="storePhone" value={form.storePhone} onChange={(event) => update("storePhone", event.target.value)} />
              </Field>
              <Field label="WhatsApp number" htmlFor="whatsappNumber" hint="Shown on the storefront and used for wa.me links.">
                <Input id="whatsappNumber" value={form.whatsappNumber} onChange={(event) => update("whatsappNumber", event.target.value)} />
              </Field>
            </div>
            <Field label="Announcement bar" htmlFor="announcement">
              <Textarea id="announcement" value={form.announcement} onChange={(event) => update("announcement", event.target.value)} />
            </Field>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-ink">Delivery & order rules</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Minimum order ₹" htmlFor="minOrderValue" hint="Fallback when a pincode zone is not set.">
                <Input
                  id="minOrderValue"
                  type="number"
                  value={form.minOrderValue}
                  onChange={(event) => update("minOrderValue", Number(event.target.value))}
                />
              </Field>
              <Field label="Free delivery above ₹" htmlFor="freeDeliveryThreshold">
                <Input
                  id="freeDeliveryThreshold"
                  type="number"
                  value={form.freeDeliveryThreshold}
                  onChange={(event) => update("freeDeliveryThreshold", Number(event.target.value))}
                />
              </Field>
              <Field label="Default delivery fee ₹" htmlFor="defaultDeliveryFee">
                <Input
                  id="defaultDeliveryFee"
                  type="number"
                  value={form.defaultDeliveryFee}
                  onChange={(event) => update("defaultDeliveryFee", Number(event.target.value))}
                />
              </Field>
              <Field label="GST %" htmlFor="taxPercent" hint="Applied on the discount-adjusted subtotal.">
                <Input
                  id="taxPercent"
                  type="number"
                  step="0.5"
                  value={form.taxPercent}
                  onChange={(event) => update("taxPercent", Number(event.target.value))}
                />
              </Field>
              <Field label="Opens at" htmlFor="openingTime">
                <Input id="openingTime" value={form.openingTime} onChange={(event) => update("openingTime", event.target.value)} />
              </Field>
              <Field label="Closes at" htmlFor="closingTime">
                <Input id="closingTime" value={form.closingTime} onChange={(event) => update("closingTime", event.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.codEnabled} onChange={(event) => update("codEnabled", event.target.checked)} />
              Cash on delivery enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.notificationsEnabled}
                onChange={(event) => update("notificationsEnabled", event.target.checked)}
              />
              Send WhatsApp order notifications
            </label>
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>
                <Save className="h-4 w-4" /> Save settings
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-brand-600" /> Credentials status
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Secrets are read from environment variables at runtime — never stored in the database or sent to the
              browser.
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex items-center justify-between">
                <span className="font-mono">DATABASE_URL</span>
                <Badge tone={data?.envStatus.databaseUrlConfigured ? "success" : "danger"}>
                  {data?.envStatus.databaseUrlConfigured ? "configured" : "missing"}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-mono">WHATSAPP_APP_SECRET</span>
                <Badge tone={data?.envStatus.whatsapp.webhookConfigured ? "success" : "warn"}>
                  {data?.envStatus.whatsapp.webhookConfigured ? "configured" : "not set"}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-mono">WHATSAPP_ACCESS_TOKEN</span>
                <Badge tone={data?.envStatus.whatsapp.sendingConfigured ? "success" : "warn"}>
                  {data?.envStatus.whatsapp.sendingConfigured ? "configured" : "not set"}
                </Badge>
              </li>
            </ul>
            {!data?.envStatus.whatsapp.sendingConfigured ? (
              <Alert tone="warn" title="Outbound WhatsApp is in log-only mode">
                <span className="block">
                  Order flows still work: notifications are recorded with status SKIPPED instead of failing the
                  order.
                </span>
              </Alert>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-ink">Audit log</h2>
            <p className="text-xs text-neutral-500">Latest sensitive operations across web and WhatsApp.</p>
            <div className="pt-3">
              {data?.audit.length === 0 ? (
                <p className="text-xs text-neutral-500">No audit entries yet.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>When</Th>
                      <Th>Action</Th>
                      <Th>Actor</Th>
                      <Th>Source</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.audit.map((entry) => (
                      <tr key={entry.id}>
                        <Td className="text-[11px] text-neutral-500">{formatDateTime(entry.createdAt)}</Td>
                        <Td className="text-[11px]">
                          {entry.action}
                          <span className="block text-neutral-400">
                            {entry.resource}
                            {entry.resourceId ? ` #${entry.resourceId}` : ""}
                          </span>
                        </Td>
                        <Td className="text-[11px]">{entry.actorLabel}</Td>
                        <Td className="text-[11px]">{entry.source.toLowerCase()}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
