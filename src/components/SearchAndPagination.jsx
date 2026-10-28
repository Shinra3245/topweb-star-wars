import React from 'react';

export function SearchAndPagination({
  searchQuery,
  onSearchChange,
  onClearSearch,
  page,
  totalPages,
  total,
  onPrevPage,
  onNextPage,
  isLoading
}) {
  return (
    <div className="controls-panel">
      <div className="search-box">
        <span className="search-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="text"
          className="search-input"
          placeholder="Buscar personaje por nombre..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar personaje por nombre"
          maxLength={100}
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={onClearSearch}
            aria-label="Limpiar búsqueda"
            title="Limpiar búsqueda"
          >
            &times;
          </button>
        )}
      </div>

      <div className="pagination-controls">
        <span className="stats-count">
          {total} {total === 1 ? 'personaje' : 'personajes'}
        </span>

        <button
          type="button"
          className="btn-page"
          onClick={onPrevPage}
          disabled={page <= 1 || isLoading}
          aria-label="Página anterior"
        >
          &larr; Anterior
        </button>

        <span className="page-indicator">
          Página <strong>{page}</strong> de <strong>{totalPages || 1}</strong>
        </span>

        <button
          type="button"
          className="btn-page"
          onClick={onNextPage}
          disabled={page >= totalPages || totalPages === 0 || isLoading}
          aria-label="Página siguiente"
        >
          Siguiente &rarr;
        </button>
      </div>
    </div>
  );
}
