import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses, whatsappIdentities } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { configStatus } from "@/lib/whatsapp";
import { ProfileView } from "@/components/profile-view";
import type { AddressRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My profile",
  description: "Manage your FreshCut profile, saved addresses and WhatsApp ordering link.",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const [addressRows, identityRows] = await Promise.all([
    db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, user.id))
      .orderBy(desc(addresses.isDefault), asc(addresses.id)),
    db
      .select({ phone: whatsappIdentities.phone, verifiedAt: whatsappIdentities.verifiedAt })
      .from(whatsappIdentities)
      .where(eq(whatsappIdentities.userId, user.id))
      .limit(1),
  ]);

  const addressList: AddressRecord[] = addressRows.map((row) => ({
    id: row.id,
    label: row.label,
    fullName: row.fullName,
    phone: row.phone,
    line1: row.line1,
    street: row.street,
    area: row.area,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    landmark: row.landmark,
    type: row.type,
    isDefault: row.isDefault,
  }));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Hello, {user.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-neutral-600">
          Manage your account, delivery addresses and WhatsApp ordering in one place.
        </p>
      </header>
      <ProfileView
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          imageUrl: user.imageUrl,
          role: user.role,
        }}
        initialAddresses={addressList}
        whatsapp={{
          linked: identityRows[0]
            ? { phone: identityRows[0].phone, verifiedAt: identityRows[0].verifiedAt.toISOString() }
            : null,
          config: configStatus(),
        }}
      />
    </div>
  );
}
