export default function ConfirmationPage({
  searchParams
}: {
  searchParams: { orderNumber?: string; total?: string }
}) {
  const orderNumber = searchParams.orderNumber || 'UNKNOWN'
  const total = searchParams.total ? parseInt(searchParams.total) : 0

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      textAlign: 'center'
    }}>
      <div style={{ maxWidth: 500 }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>✓</div>
        <h1 style={{ color: '#22c55e', marginBottom: 16 }}>Order Placed!</h1>
        
        <div style={{
          background: '#f9fafb',
          padding: 24,
          borderRadius: 12,
          marginBottom: 32
        }}>
          <p style={{ color: '#666', margin: 0, marginBottom: 8 }}>Order Number</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, marginBottom: 16 }}>
            {orderNumber}
          </p>
          <p style={{ color: '#666', margin: 0, marginBottom: 8 }}>Total</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#667eea' }}>
            ${(total / 100).toFixed(2)}
          </p>
        </div>

        <p style={{ color: '#666', marginBottom: 24 }}>
          Your order is being prepared. We'll notify you when it's ready!
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          
            href="/order"
            style={{
              padding: '12px 24px',
              background: '#667eea',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 8,
              fontWeight: 'bold'
            }}
          >
            Order Again
          </a>
          
            href="/"
            style={{
              padding: '12px 24px',
              border: '2px solid #667eea',
              color: '#667eea',
              textDecoration: 'none',
              borderRadius: 8,
              fontWeight: 'bold'
            }}
          >
            Back to Home
          </a>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 32 }}>
          Note: Payment integration coming soon! This is a demo order.
        </p>
      </div>
    </main>
  )
}