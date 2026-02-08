import "./cny.css";

export const metadata = {
  title: "You're Invited! CNY 2026 Party",
  description: "Join us for a Chinese New Year celebration - Year of the Horse",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function CNYLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "#910C1E",
      }}
    >
      {children}
    </div>
  );
}
