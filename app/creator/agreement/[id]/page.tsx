import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getCreatorById } from "@/lib/creators";
import { getOrCreateDraftAgreement } from "@/lib/creator-agreement";
import { AgreementSignForm } from "@/components/creator/AgreementSignForm";

export const dynamic = "force-dynamic";

export default async function CreatorAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creator = await getCreatorById(id);
  if (!creator) notFound();

  if (creator.status !== "approved" && creator.status !== "agreed") {
    return (
      <main className="mx-auto w-full max-w-[600px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <h1 className="font-display text-heading-l uppercase text-ink">Not Ready Yet</h1>
        <p className="mt-4 text-body-s text-secondary-text">
          This agreement link isn&apos;t active for your application yet — we&apos;ll email you once
          it is.
        </p>
      </main>
    );
  }

  const supabase = getSupabaseServerClient();
  const agreement =
    creator.status === "agreed"
      ? (await supabase.from("creator_agreements").select("*").eq("creator_id", id).order("created_at", { ascending: false }).maybeSingle()).data
      : await getOrCreateDraftAgreement(creator);

  if (!agreement) notFound();

  return (
    <main className="mx-auto w-full max-w-[680px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
      <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
        Creator Agreement
      </p>
      <h1 className="mt-2 font-display text-heading-xl uppercase text-ink">Hi, {creator.name}</h1>

      <div
        className="prose prose-sm mt-8 max-w-none text-body-s text-ink [&_h2]:font-display [&_h2]:uppercase [&_h2]:text-heading-s [&_h3]:mt-6 [&_h3]:font-display [&_h3]:uppercase [&_h3]:text-body [&_li]:text-secondary-text [&_p]:text-secondary-text"
        dangerouslySetInnerHTML={{ __html: agreement.agreement_html }}
      />

      <div className="mt-10 border-t border-divider pt-8">
        {agreement.signed_at ? (
          <div>
            <p className="text-body-s text-ink">
              Signed by <strong>{agreement.signed_name}</strong> on{" "}
              {new Date(agreement.signed_at).toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              .
            </p>
            <p className="mt-2 text-caption text-secondary-text">
              We&apos;ll be in touch with shipping details shortly.
            </p>
          </div>
        ) : (
          <AgreementSignForm creatorId={id} />
        )}
      </div>
    </main>
  );
}
