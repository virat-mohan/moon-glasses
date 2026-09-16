import Link from "next/link";
import { Fragment } from "react";

/**
 * Renders one body paragraph, turning any [[chapter-slug|Product Name]]
 * markup (written by generateJournalDraft in lib/claude.ts) into a real
 * link to that Chapter's product page — this is how a Journal article
 * actually sends someone to buy the cap it just mentioned, instead of only
 * relying on the "Cap Suggestions" grid at the end of the article.
 */
export function JournalParagraphText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const linkPattern = /\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g;
  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    const [, slug, label] = match;
    parts.push(
      <Link key={key++} href={`/chapter/${slug}`} className="underline underline-offset-4 hover:text-tan-gold">
        {label}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }

  return <>{parts}</>;
}
