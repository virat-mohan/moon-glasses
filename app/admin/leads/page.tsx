"use client";

import { useEffect, useState } from "react";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  lead_type: string | null;
  platform: string | null;
  note: string | null;
  status: string;
  created_at: string;
};

const STATUSES = ["new", "contacted", "converted", "closed"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

function sourceLabel(source: string, platform: string | null) {
  if (source === "meta_dm") return platform ? `Meta DM (${platform})` : "Meta DM";
  if (source === "meta_comment") return platform ? `Meta Comment (${platform})` : "Meta Comment";
  if (source === "website") return "Website";
  return "Other";
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  function load() {
    fetch("/api/admin/leads")
      .then((res) => res.json())
      .then((data) => setLeads(data.leads ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateStatus(id: string, status: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  const filtered = leads.filter((l) => {
    if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
    if (typeFilter !== "all" && l.lead_type !== typeFilter) return false;
    return true;
  });

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Leads</h1>
      <p className="mt-2 max-w-xl text-body-s text-secondary-text">
        Enquiries captured from the Meta DM/comment bot (and, going forward, other channels) — not
        customers yet, but the phone/email here is what future lookalike audiences and retention
        marketing campaigns should be built from.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-divider pt-6">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
        >
          <option value="all">All sources</option>
          <option value="meta_dm">Meta DM</option>
          <option value="meta_comment">Meta Comment</option>
          <option value="website">Website</option>
          <option value="other">Other</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-divider bg-surface px-2 py-1.5 text-body-s text-ink"
        >
          <option value="all">All enquiry types</option>
          <option value="buying">Buying</option>
          <option value="collaborating">Collaborating</option>
          <option value="general_enquiry">General Enquiry</option>
          <option value="restock_notify">Restock Notify</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-8 text-body-s text-secondary-text">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-body-s text-secondary-text">No leads yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-body-s">
            <thead>
              <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Note</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-divider/60">
                  <td className="py-2 pr-4 whitespace-nowrap text-secondary-text">
                    {formatDate(lead.created_at)}
                  </td>
                  <td className="py-2 pr-4">{lead.name ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {lead.phone && <div>{lead.phone}</div>}
                    {lead.email && <div className="text-secondary-text">{lead.email}</div>}
                    {!lead.phone && !lead.email && "—"}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{sourceLabel(lead.source, lead.platform)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{lead.lead_type ?? "—"}</td>
                  <td className="py-2 pr-4 max-w-[280px] truncate text-secondary-text">{lead.note ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      className="border border-divider bg-surface px-2 py-1 text-body-s text-ink"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
