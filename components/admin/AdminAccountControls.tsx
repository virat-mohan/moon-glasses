"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAccountControls() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function logout() {
    await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/admin-login");
    router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(data?.error ?? "Could not change password");
      return;
    }
    setMessage("Password changed — other devices are logged out.");
    setCurrentPassword("");
    setNewPassword("");
  }

  const input = "w-full border border-ink/30 bg-surface px-3 py-1.5 text-caption text-ink outline-none focus:border-ink";

  return (
    <div className="mt-2 border-t border-divider pt-4 text-caption">
      <div className="flex gap-4">
        <button type="button" onClick={() => setOpen(!open)} className="text-secondary-text underline">
          Change Password
        </button>
        <button type="button" onClick={logout} className="text-secondary-text underline">
          Log Out
        </button>
      </div>
      {open && (
        <form onSubmit={changePassword} className="mt-3 space-y-2">
          <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={input} />
          <input type="password" placeholder="New password (10+ characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={input} />
          <button type="submit" disabled={!currentPassword || !newPassword} className="border border-ink px-3 py-1 uppercase tracking-[0.05em] text-ink disabled:opacity-50">
            Save
          </button>
          {message && <p className="text-secondary-text">{message}</p>}
        </form>
      )}
    </div>
  );
}
