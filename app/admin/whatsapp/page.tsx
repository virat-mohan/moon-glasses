"use client";

import { useEffect, useState } from "react";

type Conversation = {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  status: string | null;
  created_at: string;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function WhatsAppInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadConversations() {
    fetch("/api/admin/whatsapp")
      .then((res) => res.json())
      .then((data) => setConversations(data.conversations ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(loadConversations, []);

  function openConversation(id: string) {
    setSelectedId(id);
    setLoadingThread(true);
    setError(null);
    fetch(`/api/admin/whatsapp/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
      })
      .finally(() => setLoadingThread(false));
  }

  async function sendReply() {
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    setError(null);
    const text = replyText;
    try {
      const res = await fetch("/api/admin/whatsapp/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send reply");
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), direction: "outbound", body: text, status: "sent", created_at: new Date().toISOString() },
      ]);
      setReplyText("");
      loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply");
    } finally {
      setSending(false);
    }
  }

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="mt-2 font-display text-heading-l uppercase text-ink">WhatsApp Inbox</h1>
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        Replies only deliver within 24 hours of the customer&apos;s last message — Meta&apos;s
        session-message rule for every WhatsApp Business inbox, not specific to this one.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-0 border border-divider md:grid-cols-[320px_1fr]">
        <div className="max-h-[70vh] overflow-y-auto border-b border-divider md:border-b-0 md:border-r">
          {loading ? (
            <p className="p-4 text-body-s text-secondary-text">Loading...</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-body-s text-secondary-text">
              No conversations yet — they&apos;ll appear here once a customer messages your WhatsApp number.
            </p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`block w-full border-b border-divider p-4 text-left hover:bg-surface-alt ${
                  selectedId === c.id ? "bg-surface-alt" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-sans text-body-s font-bold text-ink">
                    {c.customer_name || c.customer_phone}
                  </p>
                  {c.unread_count > 0 && (
                    <span className="shrink-0 rounded-full bg-tan-gold px-1.5 py-0.5 text-micro font-bold text-ink">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                <p className="truncate text-caption text-secondary-text">{c.last_message_preview}</p>
                <p className="mt-0.5 text-micro text-secondary-text/70">{formatTime(c.last_message_at)}</p>
              </button>
            ))
          )}
        </div>

        <div className="flex min-h-[50vh] flex-col">
          {!selected ? (
            <p className="p-6 text-body-s text-secondary-text">Select a conversation to view it.</p>
          ) : (
            <>
              <div className="border-b border-divider p-4">
                <p className="font-sans text-body-s font-bold text-ink">{selected.customer_name || selected.customer_phone}</p>
                <p className="text-caption text-secondary-text">{selected.customer_phone}</p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingThread ? (
                  <p className="text-body-s text-secondary-text">Loading...</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] px-3 py-2 text-body-s ${
                          m.direction === "outbound" ? "bg-ink text-cream" : "border border-divider text-ink"
                        }`}
                      >
                        <p>{m.body}</p>
                        <p className={`mt-1 text-micro ${m.direction === "outbound" ? "text-cream/60" : "text-secondary-text/70"}`}>
                          {formatTime(m.created_at)}
                          {m.direction === "outbound" && m.status === "failed" && " — failed to send"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-divider p-4">
                {error && <p className="mb-2 text-caption text-paint-orange">{error}</p>}
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a reply..."
                    className="w-full border border-divider bg-surface px-3 py-2 text-body-s text-ink"
                  />
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    className="shrink-0 border border-ink bg-ink px-4 py-2 text-caption font-bold uppercase tracking-[0.05em] text-cream disabled:opacity-40"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
