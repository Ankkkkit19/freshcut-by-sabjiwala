"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import type { AddressRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { AddressForm, type AddressFormValues } from "@/components/address-form";
import { Alert, Badge, Button, Card, ConfirmDialog, Field, Input, Modal, useToast } from "@/components/ui";

export function ProfileView({
  user,
  initialAddresses,
  whatsapp,
}: {
  user: { id: number; name: string; email: string; phone: string | null; imageUrl: string | null; role: string };
  initialAddresses: AddressRecord[];
  whatsapp: {
    linked: { phone: string; verifiedAt: string } | null;
    config: { sendingConfigured: boolean; devBypass: boolean };
  };
}) {
  const router = useRouter();
  const { push } = useToast();
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone ?? "", imageUrl: user.imageUrl ?? "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AddressRecord | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AddressRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [linkInfo, setLinkInfo] = useState<{ code: string; instructions: string; deepLink: string } | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [linked, setLinked] = useState(whatsapp.linked);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch("/api/profile", { method: "PATCH", json: profile });
      push("Profile updated", "success");
      router.refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveAddress(values: AddressFormValues) {
    setSavingAddress(true);
    setAddressError(null);
    try {
      if (editing) {
        const data = await apiFetch<{ address: AddressRecord }>(`/api/profile/addresses/${editing.id}`, {
          method: "PATCH",
          json: values,
        });
        setAddresses((prev) =>
          prev
            .map((address) => (address.id === data.address.id ? data.address : address))
            .map((address) =>
              values.isDefault && address.id !== data.address.id ? { ...address, isDefault: false } : address,
            ),
        );
      } else {
        const data = await apiFetch<{ address: AddressRecord }>("/api/profile/addresses", {
          method: "POST",
          json: values,
        });
        setAddresses((prev) => [
          data.address,
          ...prev.map((address) => (data.address.isDefault ? { ...address, isDefault: false } : address)),
        ]);
      }
      setFormOpen(false);
      setEditing(null);
      push("Address saved", "success");
      router.refresh();
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Could not save address");
    } finally {
      setSavingAddress(false);
    }
  }

  async function makeDefault(address: AddressRecord) {
    try {
      await apiFetch(`/api/profile/addresses/${address.id}`, { method: "PATCH", json: { isDefault: true } });
      setAddresses((prev) => prev.map((item) => ({ ...item, isDefault: item.id === address.id })));
      push("Default address updated", "success");
      router.refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not update address", "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/profile/addresses/${deleteTarget.id}`, { method: "DELETE" });
      setAddresses((prev) => prev.filter((address) => address.id !== deleteTarget.id));
      push("Address deleted", "info");
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not delete address", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function generateLink() {
    setLinking(true);
    try {
      const data = await apiFetch<{ code: string; instructions: string; deepLink: string }>(
        "/api/whatsapp/link",
        { method: "POST" },
      );
      setLinkInfo(data);
      push("WhatsApp link code generated — valid 15 minutes", "success");
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not generate link code", "error");
    } finally {
      setLinking(false);
    }
  }

  async function unlink() {
    setUnlinking(true);
    try {
      await apiFetch("/api/whatsapp/link", { method: "DELETE" });
      setLinked(null);
      push("WhatsApp unlinked", "info");
      router.refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not unlink", "error");
    } finally {
      setUnlinking(false);
    }
  }

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      push("Could not sign out", "error");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-4">
        <Card>
          <h2 className="text-base font-semibold text-ink">Account settings</h2>
          <form onSubmit={saveProfile} className="mt-3 space-y-3">
            <Field label="Name" htmlFor="profile-name">
              <Input
                id="profile-name"
                value={profile.name}
                onChange={(event) => setProfile((p) => ({ ...p, name: event.target.value }))}
                required
              />
            </Field>
            <Field label="Email" htmlFor="profile-email" hint="Email cannot be changed in the demo.">
              <Input id="profile-email" value={user.email} disabled />
            </Field>
            <Field label="Phone" htmlFor="profile-phone" hint="Used for delivery calls and WhatsApp.">
              <Input
                id="profile-phone"
                value={profile.phone}
                onChange={(event) => setProfile((p) => ({ ...p, phone: event.target.value }))}
              />
            </Field>
            <Field label="Profile image URL" htmlFor="profile-image">
              <Input
                id="profile-image"
                value={profile.imageUrl}
                onChange={(event) => setProfile((p) => ({ ...p, imageUrl: event.target.value }))}
                placeholder="https://…"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={savingProfile}>
                Save changes
              </Button>
              <Button type="button" variant="outline" onClick={logout}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <MessageCircle className="h-4 w-4 text-brand-600" /> WhatsApp ordering
          </h2>
          {linked ? (
            <>
              <p className="mt-2 text-sm text-neutral-700">
                Linked number <span className="font-semibold text-brand-700">{linked.phone}</span>
              </p>
              <p className="text-[11px] text-neutral-500">Verified {formatDateTime(linked.verifiedAt)}</p>
              <p className="mt-2 text-xs text-neutral-600">
                Send “2 kg potato” to your FreshCut WhatsApp line — it uses this same cart.
              </p>
              <Button variant="outline" className="mt-3" loading={unlinking} onClick={unlink}>
                Unlink WhatsApp
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-neutral-600">
                Link your WhatsApp to order by chat, track orders and receive status notifications.
              </p>
              <Button className="mt-3" loading={linking} onClick={generateLink}>
                Generate link code
              </Button>
            </>
          )}
          {linkInfo ? (
            <Alert tone="success" title={`Your code: ${linkInfo.code}`}>
              <span className="block">{linkInfo.instructions}</span>
              <a href={linkInfo.deepLink} target="_blank" rel="noreferrer" className="mt-1 block font-semibold underline">
                Open WhatsApp with this code
              </a>
              <span className="mt-1 block text-[11px]">
                Codes are one-time use, expire in 15 minutes and are blocked after 5 wrong attempts.
              </span>
            </Alert>
          ) : null}
          <p className="mt-3 text-[11px] text-neutral-500">
            {whatsapp.config.sendingConfigured
              ? "WhatsApp Cloud API credentials detected — outbound messages will be delivered."
              : "No WhatsApp Cloud API credentials in this environment: messages are logged to the database and shown in the admin console."}
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Saved addresses</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add address
          </Button>
        </div>

        {addresses.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-brand-200 p-4 text-sm text-neutral-500">
            No addresses yet. Add one so we can compute delivery fees and ETA for your pincode.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {addresses.map((address) => (
              <li key={address.id} className="rounded-xl border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{address.fullName}</span>
                  <Badge tone="neutral">{address.type.toLowerCase()}</Badge>
                  {address.isDefault ? <Badge tone="brand">default</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-neutral-600">
                  {address.line1}
                  {address.street ? `, ${address.street}` : ""}, {address.area}, {address.city}, {address.state}{" "}
                  {address.pincode}
                  {address.landmark ? ` • ${address.landmark}` : ""}
                </p>
                <p className="text-[11px] text-neutral-500">Phone {address.phone}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(address);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {!address.isDefault ? (
                    <Button size="sm" variant="ghost" onClick={() => makeDefault(address)}>
                      Make default
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(address)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-[11px] text-neutral-500">
          Looking for orders? <Link href="/orders" className="font-semibold text-brand-700 underline">View order history</Link>
        </p>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit address" : "Add a delivery address"}
      >
        <AddressForm
          initial={editing ?? undefined}
          submitting={savingAddress}
          error={addressError}
          onSubmit={saveAddress}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this address?"
        description={deleteTarget ? `${deleteTarget.line1}, ${deleteTarget.area}` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
