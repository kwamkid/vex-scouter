import { redirect } from "next/navigation";

// /scout was the original Events route. Events now live on the home page,
// so we redirect to keep old bookmarks/links working.
export default function ScoutPage() {
  redirect("/");
}
