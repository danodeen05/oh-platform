import { redirect } from "next/navigation";

/** Brands moved onto the Locations page. */
export default function TenantsPage() {
  redirect("/locations#brands");
}
