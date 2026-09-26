import { Anton, Instrument_Serif, Inter } from "next/font/google";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminAccountControls } from "@/components/admin/AdminAccountControls";
import "./admin.css";

// viratmohan.com type family: Instrument Serif (headings), Inter (UI), Anton (display accents).
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--adm-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--adm-sans" });
const display = Anton({ subsets: ["latin"], weight: "400", variable: "--adm-display" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serif.variable} ${sans.variable} ${display.variable}`}>
      <AdminShell account={<AdminAccountControls />}>{children}</AdminShell>
    </div>
  );
}
