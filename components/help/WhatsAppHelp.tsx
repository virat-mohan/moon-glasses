import { helpLink, HELP_LINK_CLASS } from "@/lib/whatsapp-help";

/** One quiet muted-caption help line. No button, no badge, no icon. */
export function WhatsAppHelp({
  label = "need a hand? whatsapp us",
  topic,
  lines,
  number,
  className = "",
}: {
  label?: string;
  topic: string;
  lines?: string[];
  number?: string | null;
  className?: string;
}) {
  return (
    <a
      href={helpLink({ topic, lines, number })}
      target="_blank"
      rel="noopener noreferrer"
      className={`${HELP_LINK_CLASS} ${className}`}
    >
      {label}
    </a>
  );
}
