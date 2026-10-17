import React from 'react';

export default function LandingHero({ onSelectTopic, theme }) {
  const stats = [
    { label: 'Publications Scanned', value: '300+' },
    { label: 'Clinical Trial Sources', value: 'Live' },
    { label: 'Evidence Synthesis', value: 'Multi-API' },
    { label: 'Reasoning Engine', value: 'Gemini 1.5' },
  ];

  const features = [
    {
      icon: '🔍',
      title: 'Deep Retrieval',
      desc: 'Fetches real-time candidates from PubMed, OpenAlex & ClinicalTrials.gov before precision filtering.'
    },
    {
      icon: '🧠',
      title: 'AI Reasoning',
      desc: 'Gemini synthesizes biomedical studies into structured, evidence-grounded summaries.'
    },
    {
      icon: '🧬',
      title: 'Clinical Trials',
      desc: 'Real-time recruiting trials with protocol criteria, trial phases, and locations.'
    },
    {
      icon: '⚡',
      title: 'Smart Re-Ranking',
      desc: 'Recency and citation impact scoring ensures the highest-grade medical evidence surfaces first.'
    }
  ];

  return (
    <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '3rem', width: '100%', maxWidth: '780px' }}>
      {/* STATS STRIP */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        padding: '1.25rem 0',
        borderTop: `1px solid ${theme.border}`,
        borderBottom: `1px solid ${theme.border}`,
        textAlign: 'center'
      }}>
        {stats.map((s, idx) => (
          <div key={idx}>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: theme.primary }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: theme.subText, marginTop: '0.2rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* BUILT FOR PRECISION 2x2 GRID */}
      <div>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: theme.text, margin: 0 }}>Built for Precision</h3>
          <p style={{ fontSize: '0.8rem', color: theme.subText, marginTop: '0.35rem' }}>
            Every layer of the pipeline is designed for depth, biomedical accuracy, and reliability.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {features.map((f, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: theme.cardBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '16px',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
            >
              <div style={{ fontSize: '1.4rem' }}>{f.icon}</div>
              <div style={{ fontSize: '0.92rem', fontWeight: '700', color: theme.text }}>{f.title}</div>
              <div style={{ fontSize: '0.78rem', color: theme.subText, lineHeight: '1.4' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}