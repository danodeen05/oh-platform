export const metadata = {
  title: "Oh Beef Noodle Soup",
  description: "Order your favorite noodle soup",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
