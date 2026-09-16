"use client";

import { useEffect, useState } from "react";
import { downloadCsv } from "@/lib/csv-export";

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  paid_by: string;
  description: string | null;
  amount: number;
};

const COMMON_CATEGORIES = ["Salary", "Packaging", "Ad Spend", "Rent", "Software", "Shipping", "Other"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("Salary");
  const [paidBy, setPaidBy] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/expenses")
      .then((res) => res.json())
      .then((data) => setExpenses(data.expenses ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseDate, category, paidBy, description, amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save expense");
      setPaidBy("");
      setDescription("");
      setAmount("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save expense");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this expense entry?")) return;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  function exportCsv() {
    downloadCsv("moonglasses-expenses.csv", [
      ["Date", "Category", "Paid By", "Description", "Amount"],
      ...expenses.map((e) => [formatDate(e.expense_date), e.category, e.paid_by, e.description ?? "", e.amount]),
      ["", "", "", "Total", total],
    ]);
  }

  return (
    <main className="mx-auto w-full max-w-[1000px] px-6 pt-28 pb-24 md:px-12">
      <div className="flex items-center justify-between">
        <h1 className="mt-2 font-display text-heading-l uppercase text-ink">Expenses</h1>
        {expenses.length > 0 && (
          <button
            onClick={exportCsv}
            className="border border-divider px-4 py-2 text-caption uppercase tracking-[0.05em] text-ink hover:border-ink"
          >
            Export CSV
          </button>
        )}
      </div>
      <p className="mt-2 max-w-lg text-body-s text-secondary-text">
        Manual expense log — salaries, packaging, rent, ad spend, anything else. Feeds the P&amp;L
        view directly.
      </p>

      <form onSubmit={addExpense} className="mt-8 flex flex-wrap items-end gap-4 border-t border-divider pt-6">
        <div>
          <label className="block text-caption text-secondary-text">Date</label>
          <input
            required
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="mt-1 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          >
            {COMMON_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Paid By</label>
          <input
            required
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            placeholder="e.g. Ishan, Business Account"
            className="mt-1 w-40 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this for?"
            className="mt-1 w-52 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <div>
          <label className="block text-caption text-secondary-text">Amount (₹)</label>
          <input
            required
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-28 border border-divider bg-surface px-2 py-1.5 font-sans text-body-s text-ink"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="border border-ink bg-ink px-5 py-2 font-sans text-caption font-bold uppercase tracking-[0.05em] text-cream hover:bg-cream hover:text-ink disabled:opacity-50"
        >
          {saving ? "Saving..." : "Add Expense"}
        </button>
      </form>
      {error && <p className="mt-3 text-body-s text-paint-orange">{error}</p>}

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="border-b border-divider text-caption uppercase tracking-[0.05em] text-secondary-text">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Paid By</th>
              <th className="py-2 pr-4">Description</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-body-s text-secondary-text">
                  Loading...
                </td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-body-s text-secondary-text">
                  No expenses logged yet.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-b border-divider">
                  <td className="py-3 text-caption text-secondary-text">{formatDate(e.expense_date)}</td>
                  <td className="py-3 font-sans text-body-s text-ink">{e.category}</td>
                  <td className="py-3 text-caption text-secondary-text">{e.paid_by}</td>
                  <td className="py-3 text-caption text-secondary-text">{e.description ?? "—"}</td>
                  <td className="py-3 font-sans text-body-s text-ink">₹{e.amount.toLocaleString("en-IN")}</td>
                  <td className="py-3">
                    <button onClick={() => remove(e.id)} className="text-micro text-secondary-text underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr className="border-t border-divider">
                <td colSpan={4} className="py-3 text-right font-sans text-body-s text-ink">
                  Total
                </td>
                <td className="py-3 font-sans text-body-s font-bold text-ink">
                  ₹{total.toLocaleString("en-IN")}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </main>
  );
}
