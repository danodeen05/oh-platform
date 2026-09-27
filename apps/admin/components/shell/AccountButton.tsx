"use client";
import { UserButton } from "@clerk/nextjs";
import { useRole } from "@/components/providers/RoleProvider";

/** Clerk's account menu in production; a role chip in local dev, where Clerk is skipped. */
export function AccountButton() {
  const role = useRole();
  if (process.env.NODE_ENV !== "production") {
    return (
      <span title="Local dev. Set ADMIN_DEV_ROLE to preview another role."
        className="inline-flex min-h-8 items-center whitespace-nowrap rounded-full bg-oh-gold/15 px-2.5 text-xs font-semibold text-oh-gold">
        Dev · {role}
      </span>
    );
  }
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center">
      <UserButton />
    </span>
  );
}
