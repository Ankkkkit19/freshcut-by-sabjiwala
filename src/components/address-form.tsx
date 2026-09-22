"use client";

import { useState } from "react";
import type { AddressRecord } from "@/lib/types";
import { Button, Field, Input, Select } from "@/components/ui";

export type AddressFormValues = {
  fullName: string;
  phone: string;
  line1: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  type: "HOME" | "WORK" | "OTHER";
  isDefault: boolean;
};

const EMPTY: AddressFormValues = {
  fullName: "",
  phone: "",
  line1: "",
  street: "",
  area: "",
  city: "",
  state: "Maharashtra",
  pincode: "",
  landmark: "",
  type: "HOME",
  isDefault: false,
};

export function AddressForm({
  initial,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<AddressRecord>;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (values: AddressFormValues) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<AddressFormValues>({
    ...EMPTY,
    ...(initial
      ? {
          fullName: initial.fullName ?? "",
          phone: initial.phone ?? "",
          line1: initial.line1 ?? "",
          street: initial.street ?? "",
          area: initial.area ?? "",
          city: initial.city ?? "",
          state: initial.state ?? "Maharashtra",
          pincode: initial.pincode ?? "",
          landmark: initial.landmark ?? "",
          type: initial.type ?? "HOME",
          isDefault: initial.isDefault ?? false,
        }
      : {}),
  });

  const [localError, setLocalError] = useState<string | null>(null);

  function update<K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(values.pincode)) {
      setLocalError("Pincode must be 6 digits.");
      return;
    }
    setLocalError(null);
    onSubmit(values);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" error={localError}>
          <Input
            id="fullName"
            value={values.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            required
            minLength={2}
          />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input
            id="phone"
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            placeholder="+91 98765 43210"
            required
          />
        </Field>
        <Field label="House / Flat" htmlFor="line1">
          <Input
            id="line1"
            value={values.line1}
            onChange={(event) => update("line1", event.target.value)}
            placeholder="Flat 402, Green Residency"
            required
          />
        </Field>
        <Field label="Street" htmlFor="street">
          <Input
            id="street"
            value={values.street}
            onChange={(event) => update("street", event.target.value)}
            placeholder="12th Cross Road"
          />
        </Field>
        <Field label="Area" htmlFor="area">
          <Input
            id="area"
            value={values.area}
            onChange={(event) => update("area", event.target.value)}
            placeholder="Andheri West"
            required
          />
        </Field>
        <Field label="City" htmlFor="city">
          <Input
            id="city"
            value={values.city}
            onChange={(event) => update("city", event.target.value)}
            placeholder="Mumbai"
            required
          />
        </Field>
        <Field label="State" htmlFor="state">
          <Input
            id="state"
            value={values.state}
            onChange={(event) => update("state", event.target.value)}
            required
          />
        </Field>
        <Field label="Pincode" htmlFor="pincode" error={localError}>
          <Input
            id="pincode"
            value={values.pincode}
            onChange={(event) => update("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            required
          />
        </Field>
        <Field label="Landmark" htmlFor="landmark">
          <Input
            id="landmark"
            value={values.landmark}
            onChange={(event) => update("landmark", event.target.value)}
            placeholder="Near metro station"
          />
        </Field>
        <Field label="Address type" htmlFor="type">
          <Select
            id="type"
            value={values.type}
            onChange={(event) => update("type", event.target.value as AddressFormValues["type"])}
          >
            <option value="HOME">Home</option>
            <option value="WORK">Work</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={values.isDefault}
          onChange={(event) => update("isDefault", event.target.checked)}
        />
        Make this my default delivery address
      </label>

      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={submitting}>
          Save address
        </Button>
      </div>
    </form>
  );
}
