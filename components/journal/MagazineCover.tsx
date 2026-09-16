import Image from "next/image";
import Link from "next/link";
import type { JournalArticle, JournalIssue } from "@/lib/journal";

export function MagazineCover({
  issue,
  articles,
  coverImage,
}: {
  issue: JournalIssue;
  articles: JournalArticle[];
  coverImage: string;
}) {
  const issueTitle = issue.name.replace(/^Issue No\. \d+ — /, "");

  return (
    <Link href={`/journal/issue/${issue.number}`} className="group block">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-charcoal shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]">
        <Image
          src={coverImage}
          alt={issueTitle}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/5 to-black/85" />

        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex items-center justify-between">
            <Image
              src="/images/brand/moonglasses-logo-mono-white.png"
              alt=""
              width={40}
              height={30}
              className="h-6 w-auto"
            />
            <p className="font-display text-[0.7rem] uppercase tracking-[0.2em] text-white">
              Moonglasses Journal
            </p>
          </div>

          <div>
            <p className="text-micro uppercase tracking-[0.2em] text-white/70">
              Issue No. {String(issue.number).padStart(2, "0")}
            </p>
            <p className="mt-1 font-display text-heading-m uppercase leading-[0.95] text-white">
              {issueTitle}
            </p>
            <div className="mt-4 space-y-1 border-t border-white/25 pt-3">
              {articles.slice(0, 4).map((a) => (
                <p key={a.slug} className="text-caption uppercase tracking-[0.03em] text-white/85">
                  {a.title}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
