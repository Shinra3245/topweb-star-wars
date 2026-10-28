import React from 'react';

export function SkeletonGrid({ count = 12 }) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div className="gallery-grid" aria-busy="true" aria-label="Cargando personajes...">
      {items.map((key) => (
        <div key={key} className="skeleton-card">
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            <div className="skeleton-box" style={{ width: 44, height: 44 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton-box" style={{ width: '70%', height: 18 }} />
              <div className="skeleton-box" style={{ width: '40%', height: 12 }} />
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton-box" style={{ width: '90%', height: 14 }} />
            <div className="skeleton-box" style={{ width: '60%', height: 14 }} />
            <div className="skeleton-box" style={{ width: '80%', height: 14 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
