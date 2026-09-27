import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseRole } from "@/lib/access";
import { ROLE_HEADER } from "@/lib/roles";
import { RoleProvider } from "@/components/providers/RoleProvider";
import { LocationProvider } from "@/components/providers/LocationProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { ConsoleShell } from "@/components/shell/ConsoleShell";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const role = parseRole((await headers()).get(ROLE_HEADER));
  if (!role) redirect("/unauthorized");
  return (
    <RoleProvider role={role}>
      <LocationProvider>
        <ToastProvider>
          <ConfirmProvider>
            <ConsoleShell>{children}</ConsoleShell>
          </ConfirmProvider>
        </ToastProvider>
      </LocationProvider>
    </RoleProvider>
  );
}
