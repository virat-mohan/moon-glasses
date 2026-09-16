type Props = { searchParams: Promise<{ session?: string }> };

export default async function CartFeedbackOtherPage({ searchParams }: Props) {
  const { session } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6">
      <h1 className="text-heading-m font-bold uppercase tracking-[0.02em] text-ink">Tell Us More.</h1>
      <p className="mt-3 text-body-s text-secondary-text">What made you hold off? A line or two helps a lot.</p>
      {session ? (
        <form action="/api/cart-feedback/other" method="POST" className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="session" value={session} />
          <textarea
            name="note"
            rows={4}
            maxLength={1000}
            className="border border-ink/30 p-3 text-body-s text-ink"
            placeholder="Your thoughts..."
          />
          <button
            type="submit"
            className="bg-ink px-6 py-3 text-body-s font-bold uppercase tracking-[0.03em] text-cream"
          >
            Submit
          </button>
        </form>
      ) : (
        <p className="mt-6 text-body-s text-secondary-text">This link looks incomplete.</p>
      )}
    </div>
  );
}
