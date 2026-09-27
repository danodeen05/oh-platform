import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="oh-console flex min-h-svh flex-col items-center justify-center gap-8 bg-oh-charcoal px-6 py-12">
      <img src="/Oh_Logo_Mark_Light.png" alt="Oh!" className="h-12 w-12 object-contain" />
      <SignIn />
    </div>
  );
}
