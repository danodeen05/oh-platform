import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.API_URL || 'http://localhost:4000';

export async function GET() {
  // Return API usage info
  return NextResponse.json({
    endpoint: '/api/agents/ideas',
    method: 'POST',
    description: 'Submit a new idea for autonomous agent processing',
    body: {
      idea: 'Required - Description of the feature or improvement',
      metadata: 'Optional - Additional context',
    },
  });
}

export async function POST(request: NextRequest) {
  // Require authentication
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const res = await fetch(`${API_URL}/agents/ideas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying to API:', error);
    return NextResponse.json({ error: 'Failed to connect to API' }, { status: 502 });
  }
}
