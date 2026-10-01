import { redirect } from "next/navigation";

/** /creator itself has no page; the programme starts at the application. */
export default function CreatorIndex() {
  redirect("/creator/apply");
}
