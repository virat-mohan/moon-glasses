const WHATSAPP_NUMBER = "918800339125";

export function WhatsAppFloatButton() {
  return (
    <div className="group fixed bottom-6 right-6 z-40">
      <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded bg-ink px-3 py-1.5 font-sans text-micro uppercase tracking-[0.05em] text-cream opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        Chat on WhatsApp
      </span>
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-200 hover:scale-105"
      >
        <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" aria-hidden="true">
          <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.207.6 4.334 1.74 6.198L3 29l7.99-2.09A11.96 11.96 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.8a9.77 9.77 0 0 1-4.98-1.362l-.357-.212-4.744 1.24 1.267-4.624-.233-.376A9.76 9.76 0 0 1 6.2 15c0-5.404 4.4-9.8 9.804-9.8 5.403 0 9.8 4.396 9.8 9.8s-4.397 9.8-9.8 9.8Zm5.37-7.34c-.294-.148-1.74-.86-2.01-.958-.27-.099-.467-.148-.663.148-.196.295-.76.958-.932 1.155-.172.196-.343.221-.638.074-.294-.148-1.243-.459-2.368-1.464-.875-.78-1.466-1.744-1.638-2.038-.172-.295-.018-.454.13-.601.133-.133.294-.344.442-.516.147-.172.196-.295.294-.492.098-.196.049-.369-.025-.516-.074-.148-.663-1.605-.909-2.198-.24-.577-.482-.499-.663-.508l-.564-.01c-.196 0-.516.074-.786.369-.27.295-1.032 1.008-1.032 2.46 0 1.45 1.057 2.85 1.204 3.047.147.196 2.081 3.18 5.043 4.46.704.304 1.253.485 1.681.62.706.225 1.348.193 1.856.117.566-.084 1.74-.712 1.985-1.4.246-.688.246-1.278.172-1.4-.074-.123-.27-.196-.565-.344Z" />
        </svg>
      </a>
    </div>
  );
}
