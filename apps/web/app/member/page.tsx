import MemberDashboard from "./member-dashboard";

export default function MemberPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: 0,
      }}
    >
      <MemberDashboard />
    </main>
  );
}
