import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <div style={{ padding: '2rem' }}>
      <SignedOut>
        <h1>Oh Beef Noodle Soup</h1>
        <p>Please sign in to order</p>
        <SignInButton mode="modal">
          <button style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
      
      <SignedIn>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Welcome to Oh Beef Noodle Soup!</h1>
          <UserButton />
        </div>
        <p>You're signed in and ready to order.</p>
      </SignedIn>
    </div>
  );
}
