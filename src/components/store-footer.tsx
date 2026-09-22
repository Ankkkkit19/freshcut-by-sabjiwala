import Link from "next/link";
import { Camera, Leaf, Mail, MapPin, MessageCircle, Phone, ThumbsUp } from "lucide-react";

export function StoreFooter({
  categories,
  settings,
}: {
  categories: { name: string; slug: string }[];
  settings: {
    storeName: string;
    storePhone: string;
    whatsappNumber: string;
    supportEmail: string;
    openingTime: string;
    closingTime: string;
  };
}) {
  return (
    <footer className="mt-10 border-t border-brand-100 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
              <Leaf className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-bold text-brand-800">FreshCut</p>
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">by {settings.storeName}</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            Fresh vegetables. Fresh cuts. Delivered fresh. Sourced every morning, cut in our FSSAI-certified
            kitchen and dropped at your door in {settings.openingTime}–{settings.closingTime}.
          </p>
          <div className="mt-3 flex gap-2 text-brand-700">
            <span aria-hidden className="rounded-full bg-brand-50 p-2">
              <Camera className="h-4 w-4" aria-hidden />
            </span>
            <span aria-hidden className="rounded-full bg-brand-50 p-2">
              <ThumbsUp className="h-4 w-4" aria-hidden />
            </span>
            <a
              href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Chat on WhatsApp"
              className="rounded-full bg-brand-50 p-2 hover:bg-brand-100"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        </div>

        <nav aria-label="Shop">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-800">Shop</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-600">
            <li>
              <Link href="/products" className="hover:text-brand-700">
                All products
              </Link>
            </li>
            {categories.slice(0, 5).map((category) => (
              <li key={category.slug}>
                <Link href={`/products?category=${category.slug}`} className="hover:text-brand-700">
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/offers" className="hover:text-brand-700">
                Offers & coupons
              </Link>
            </li>
            <li>
              <Link href="/recipes" className="hover:text-brand-700">
                Recipe ideas
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-800">Your account</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-600">
            <li>
              <Link href="/login" className="hover:text-brand-700">
                Login
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-brand-700">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-brand-700">
                Track orders
              </Link>
            </li>
            <li>
              <Link href="/profile" className="hover:text-brand-700">
                Profile & addresses
              </Link>
            </li>
            <li>
              <Link href="/forgot-password" className="hover:text-brand-700">
                Reset password
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-800">Delivery & support</h2>
          <ul className="mt-3 space-y-3 text-sm text-neutral-600">
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-brand-600" />
              <a href={`tel:${settings.storePhone}`} className="hover:text-brand-700">
                {settings.storePhone}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 h-4 w-4 text-brand-600" />
              <a
                href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-brand-700"
              >
                Order on WhatsApp {settings.whatsappNumber}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-brand-600" />
              <a href={`mailto:${settings.supportEmail}`} className="hover:text-brand-700">
                {settings.supportEmail}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-brand-600" />
              <span>Cut kitchen: Rajendra nagar Terminal Patna Bihar</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-50 px-4 py-4 text-center text-[11px] text-neutral-500">
        © {new Date().getFullYear()} {settings.storeName} / FreshCut. Prices in INR, inclusive of GST. Demo data
        seeded for evaluation.
      </div>
    </footer>
  );
}
