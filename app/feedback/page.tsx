import { FeedbackForm } from "@/components/reviews/FeedbackForm";
import { REVIEW_COPY as C } from "@/lib/review-core";

export const metadata = { title: "Share feedback" };

export default function FeedbackPage() {
  return (
    <main className="mx-auto w-full max-w-[600px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <h1 className="font-display text-heading-xl text-ink">{C.feedbackTitle}</h1>
      <p className="mt-3 max-w-md text-base text-secondary-text">{C.feedbackIntro}</p>
      <FeedbackForm />
    </main>
  );
}
