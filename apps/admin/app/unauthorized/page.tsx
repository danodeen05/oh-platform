import { SignOutButton } from "@clerk/nextjs";
import { Button, LinkButton } from "@/components/ui/Button";

export default function UnauthorizedPage() {
  return (
    <div className="oh-console flex min-h-svh flex-col items-center justify-center gap-6 bg-oh-charcoal px-6 py-12 text-center text-oh-cream">
      <img src="/Oh_Logo_Mark_Light.png" alt="Oh!" className="h-12 w-12 object-contain" />
      <div className="max-w-sm space-y-2">
        <h1 className="font-display text-[2rem] leading-tight">Access denied</h1>
        <p className="text-[15px] text-oh-cream/70">This account doesn&apos;t have admin access.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <SignOutButton>
          <Button variant="primary">Sign out</Button>
        </SignOutButton>
        <LinkButton href="https://ohbeef.com" variant="secondary">Go to the main site</LinkButton>
      </div>
    </div>
  );
}
