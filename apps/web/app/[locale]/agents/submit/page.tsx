'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitIdea } from '@/lib/agents/api';

export default function SubmitIdeaPage() {
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!idea.trim()) {
      setError('Please enter an idea');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const run = await submitIdea(idea.trim());
      router.push(`/en/agents/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit idea');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container section-padding fade-in" style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ marginBottom: '8px' }}>Submit New Idea</h1>
        <p style={{ color: 'var(--color-text-light)', margin: 0 }}>
          Describe your idea and let the agent team evaluate, design, and implement it.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '32px' }}>
          <label
            htmlFor="idea"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '12px',
              letterSpacing: '0.5px',
            }}
          >
            Your Idea
          </label>
          <textarea
            id="idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={6}
            disabled={isSubmitting}
            placeholder="Describe the feature or improvement you want to build...

Example: Add user authentication with OAuth2 support for Google and GitHub. Include session management, role-based access control, and a secure token refresh mechanism."
            style={{
              width: '100%',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.5)',
              border: '1px solid var(--color-border)',
              borderRadius: '2px',
              fontFamily: 'inherit',
              fontSize: '1rem',
              lineHeight: 1.6,
              resize: 'vertical',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', marginTop: '12px' }}>
            Be specific about what you want to achieve. The more detail you provide, the better the agents can evaluate and implement your idea.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(139, 58, 58, 0.1)',
              border: '1px solid rgba(139, 58, 58, 0.2)',
              borderRadius: '2px',
              padding: '16px',
              marginBottom: '32px',
              color: '#8B3A3A',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <button
            type="submit"
            disabled={isSubmitting || !idea.trim()}
            className="button-primary"
            style={{
              opacity: isSubmitting || !idea.trim() ? 0.5 : 1,
              cursor: isSubmitting || !idea.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isSubmitting ? (
              <>
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <span>Submitting...</span>
              </>
            ) : (
              <span>Submit to CEO</span>
            )}
          </button>
          <Link
            href="/en/agents"
            style={{ color: 'var(--color-text-light)', textDecoration: 'none', fontSize: '0.875rem' }}
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="divider" style={{ margin: '48px 0' }} />

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.5)',
          border: '1px solid var(--color-border)',
          borderRadius: '2px',
          padding: '32px',
        }}
      >
        <h3 style={{ fontWeight: 400, marginBottom: '24px', fontSize: '1rem', letterSpacing: '0.5px' }}>
          What happens next?
        </h3>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[
            { step: '1', title: 'CEO Review', desc: 'Strategic evaluation of your idea' },
            { step: '2', title: 'Specialist Review', desc: 'CTO, CPO, and CISO analyze in parallel' },
            { step: '3', title: 'Architecture', desc: 'Design the implementation blueprint' },
            { step: '4', title: 'Implementation', desc: 'Build the feature' },
            { step: '5', title: 'Code Review', desc: 'QA, DevOps, and Doc review' },
          ].map((item) => (
            <li key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
              <span
                style={{
                  background: 'var(--color-accent)',
                  color: 'white',
                  width: '24px',
                  height: '24px',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                {item.step}
              </span>
              <span style={{ color: 'var(--color-text-light)', fontSize: '0.875rem' }}>
                <strong style={{ color: 'var(--color-text)', fontWeight: 500 }}>{item.title}</strong>
                {' '}&mdash; {item.desc}
              </span>
            </li>
          ))}
        </ol>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-light)',
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '1px solid var(--color-border)',
            marginBottom: 0,
          }}
        >
          You'll be asked to approve at each major phase before proceeding.
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        textarea:focus {
          outline: none;
          border-color: var(--color-accent);
          background: rgba(255, 255, 255, 0.8);
        }
      `}</style>
    </div>
  );
}
