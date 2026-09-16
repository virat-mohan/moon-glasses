"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = { id: string; phone: string | null; name: string | null; email: string | null; newsletter_subscribed: boolean };
type Address = {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
  is_default: boolean;
};
type Order = { id: string; created_at: string; total: number; status: string; returnEligible?: boolean };
type Loyalty = { balance: number; threshold: number; valueRupees: number; maxRedeemableRupees: number };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export default function AccountPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedProfile, setSavedProfile] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [referFriend, setReferFriend] = useState({ name: "", phone: "", email: "" });
  const [referring, setReferring] = useState(false);
  const [referResult, setReferResult] = useState<string | null>(null);
  const [referError, setReferError] = useState<string | null>(null);

  const [newAddress, setNewAddress] = useState({
    label: "",
    recipientName: "",
    phone: "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [addingAddress, setAddingAddress] = useState(false);

  function load() {
    fetch("/api/account/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.customer) {
          router.push("/account/login?redirect=/account");
          return;
        }
        setCustomer(data.customer);
        setAddresses(data.addresses ?? []);
        setOrders(data.orders ?? []);
        setLoyalty(data.loyalty);
        setReferralCode(data.referralCode ?? null);
        setReferralCount(data.referralCount ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function sendReferral(e: React.FormEvent) {
    e.preventDefault();
    setReferring(true);
    setReferResult(null);
    setReferError(null);
    try {
      const res = await fetch("/api/account/refer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendName: referFriend.name,
          friendPhone: referFriend.phone,
          friendEmail: referFriend.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the invite");
      setReferResult(`Sent! ${referFriend.name} will hear from us shortly.`);
      setReferFriend({ name: "", phone: "", email: "" });
    } catch (err) {
      setReferError(err instanceof Error ? err.message : "Could not send the invite");
    } finally {
      setReferring(false);
    }
  }

  async function updateProfile(patch: Partial<Customer>) {
    if (!customer) return;
    setCustomer({ ...customer, ...patch });
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavedProfile(true);
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddingAddress(true);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAddress),
      });
      if (res.ok) {
        setNewAddress({ label: "", recipientName: "", phone: "", addressLine: "", city: "", state: "", pincode: "" });
        load();
      }
    } finally {
      setAddingAddress(false);
    }
  }

  async function setDefaultAddress(id: string) {
    await fetch("/api/account/addresses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, setDefault: true }),
    });
    load();
  }

  async function removeAddress(id: string) {
    await fetch("/api/account/addresses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading || !customer) {
    return (
      <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-body-s text-secondary-text">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[700px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">Account</p>
          <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
            {customer.name || "Your Account"}
          </h1>
        </div>
        <button onClick={logOut} className="text-caption text-secondary-text underline">
          Log Out
        </button>
      </div>

      {loyalty && (
        <div className="mt-10 border border-tan-gold/40 bg-tan-gold/10 p-6">
          <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">Moonglasses Miles</p>
          <p className="mt-1 font-display text-heading-l text-ink">{loyalty.balance.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-caption text-secondary-text">
            Every {loyalty.threshold.toLocaleString("en-IN")} Miles = ₹{loyalty.valueRupees.toLocaleString("en-IN")}{" "}
            off. {loyalty.maxRedeemableRupees > 0
              ? `You can redeem ₹${loyalty.maxRedeemableRupees.toLocaleString("en-IN")} right now at checkout.`
              : "Keep buying to unlock your first redemption."}
          </p>
        </div>
      )}

      {referralCode && (
        <section className="mt-8 border border-divider p-6">
          <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">
            Recommend to a Fellow Explorer
          </p>
          <p className="mt-2 max-w-md text-body-s text-secondary-text">
            Share your code — they get a discount on their first order, you earn Miles once it ships.
            {referralCount > 0 && ` You've referred ${referralCount} order${referralCount === 1 ? "" : "s"} so far.`}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <code className="border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s tracking-[0.1em] text-ink">
              {referralCode}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?ref=${referralCode}`)}
              className="text-caption text-secondary-text underline"
            >
              Copy Link
            </button>
          </div>

          <form onSubmit={sendReferral} className="mt-5 flex flex-wrap items-start gap-2 border-t border-divider pt-5">
            <input
              type="text"
              required
              placeholder="Friend's name"
              value={referFriend.name}
              onChange={(e) => setReferFriend((f) => ({ ...f, name: e.target.value }))}
              className="w-36 border border-ink/30 bg-surface px-3 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
            <input
              type="tel"
              placeholder="Their phone"
              value={referFriend.phone}
              onChange={(e) => setReferFriend((f) => ({ ...f, phone: e.target.value }))}
              className="w-36 border border-ink/30 bg-surface px-3 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
            <input
              type="email"
              placeholder="Their email"
              value={referFriend.email}
              onChange={(e) => setReferFriend((f) => ({ ...f, email: e.target.value }))}
              className="w-48 border border-ink/30 bg-surface px-3 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={referring}
              className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
            >
              {referring ? "Sending..." : "Send"}
            </button>
            {referResult && <p className="w-full text-caption text-ink">{referResult}</p>}
            {referError && <p className="w-full text-caption text-paint-orange">{referError}</p>}
          </form>
        </section>
      )}

      <section className="mt-12 border-t border-divider pt-8">
        <h2 className="font-display text-heading-s uppercase text-ink">Profile</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Name
            </label>
            <input
              defaultValue={customer.name ?? ""}
              onBlur={(e) => updateProfile({ name: e.target.value })}
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block font-sans text-caption uppercase tracking-[0.1em] text-secondary-text">
              Email
            </label>
            <input
              type="email"
              defaultValue={customer.email ?? ""}
              onBlur={(e) => updateProfile({ email: e.target.value })}
              className="mt-2 w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none focus:border-ink"
            />
          </div>
          <p className="text-caption text-secondary-text">Phone: {customer.phone || "Not provided"}</p>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={customer.newsletter_subscribed}
              onChange={(e) => updateProfile({ newsletter_subscribed: e.target.checked })}
              className="h-4 w-4 accent-ink"
            />
            <span className="font-sans text-body-s text-ink">Send me new Journal stories by email</span>
          </label>
          {savedProfile && <p className="text-caption text-tan-gold">Saved ✓</p>}
        </div>
      </section>

      <section className="mt-12 border-t border-divider pt-8">
        <h2 className="font-display text-heading-s uppercase text-ink">Saved Addresses</h2>
        <div className="mt-4 space-y-4">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-4 border border-divider p-4">
              <div>
                {a.is_default && (
                  <span className="text-micro uppercase tracking-[0.05em] text-tan-gold">Default</span>
                )}
                <p className="text-body-s text-ink">
                  {a.recipient_name} · {a.phone}
                </p>
                <p className="text-caption text-secondary-text">{a.address_line}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                {!a.is_default && (
                  <button
                    onClick={() => setDefaultAddress(a.id)}
                    className="text-caption text-secondary-text underline"
                  >
                    Set Default
                  </button>
                )}
                <button onClick={() => removeAddress(a.id)} className="text-caption text-paint-orange underline">
                  Remove
                </button>
              </div>
            </div>
          ))}
          {addresses.length === 0 && (
            <p className="text-body-s text-secondary-text">No saved addresses yet.</p>
          )}
        </div>

        <form onSubmit={addAddress} className="mt-6 space-y-3 border-t border-divider pt-6">
          <p className="text-caption uppercase tracking-[0.1em] text-secondary-text">Add An Address</p>
          <input
            required
            placeholder="Recipient name"
            value={newAddress.recipientName}
            onChange={(e) => setNewAddress((a) => ({ ...a, recipientName: e.target.value }))}
            className="w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
          />
          <input
            required
            placeholder="Phone"
            value={newAddress.phone}
            onChange={(e) => setNewAddress((a) => ({ ...a, phone: e.target.value }))}
            className="w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
          />
          <textarea
            required
            rows={2}
            placeholder="Address"
            value={newAddress.addressLine}
            onChange={(e) => setNewAddress((a) => ({ ...a, addressLine: e.target.value }))}
            className="w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="City"
              value={newAddress.city}
              onChange={(e) => setNewAddress((a) => ({ ...a, city: e.target.value }))}
              className="w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
            />
            <input
              required
              placeholder="State"
              value={newAddress.state}
              onChange={(e) => setNewAddress((a) => ({ ...a, state: e.target.value }))}
              className="w-full border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
            />
          </div>
          <input
            required
            placeholder="Pincode"
            value={newAddress.pincode}
            onChange={(e) => setNewAddress((a) => ({ ...a, pincode: e.target.value }))}
            className="w-full max-w-[200px] border border-ink/30 bg-surface px-4 py-2 font-sans text-body-s text-ink outline-none placeholder:text-secondary-text focus:border-ink"
          />
          <button
            type="submit"
            disabled={addingAddress}
            className="border border-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-ink transition-colors duration-300 hover:bg-ink hover:text-cream disabled:opacity-50"
          >
            {addingAddress ? "Adding..." : "Add Address"}
          </button>
        </form>
      </section>

      <section className="mt-12 border-t border-divider pt-8">
        <h2 className="font-display text-heading-s uppercase text-ink">Order History</h2>
        <div className="mt-4 space-y-2">
          {orders.length === 0 ? (
            <p className="text-body-s text-secondary-text">No orders yet.</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-body-s">
                <span className="text-secondary-text">
                  {formatDate(o.created_at)} · #{o.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-ink">₹{o.total.toLocaleString("en-IN")}</span>
                  {o.returnEligible && (
                    <a href={`/return/${o.id}`} className="text-caption text-ink underline underline-offset-4">
                      Request Return
                    </a>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
