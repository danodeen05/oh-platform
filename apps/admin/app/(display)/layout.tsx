import { headers } from "next/headers";
import { parseRole } from "@/lib/access";
import { ROLE_HEADER } from "@/lib/roles";
import { DisplaySwitcher } from "@/components/shell/DisplaySwitcher";

/** The old root <body> font, so the displays render exactly as they did before the shell. */
const DISPLAY_FONT = { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" };

/** Kitchen and Cleaning run full-screen on mounted tablets: no console chrome. */
export default async function DisplayLayout({ children }: { children: React.ReactNode }) {
  const role = parseRole((await headers()).get(ROLE_HEADER));
  return (
    <div style={DISPLAY_FONT}>
      {children}
      <DisplaySwitcher canOpenConsole={role === "owner" || role === "manager"} />
    </div>
  );
}
