export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial'}}>
        <main style={{padding:24}}>
          <h1>Oh Admin</h1>
          {children}
        </main>
      </body>
    </html>
  )
}
