import React from 'react';

/**
 * Genera un monograma sobrio de 2 caracteres a partir del nombre del personaje.
 */
export function getMonogram(name = '') {
  if (!name) return 'SW';
  const clean = name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  const parts = clean.split(/[\s-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (name.substring(0, 2) || 'SW').toUpperCase();
}

/**
 * Traduce el valor de género al español para una lectura más natural.
 */
export function formatGender(gender) {
  if (!gender || gender === 'n/a' || gender === 'none') return 'No aplica';
  if (gender === 'male') return 'Masculino';
  if (gender === 'female') return 'Femenino';
  if (gender === 'hermaphrodite') return 'Hermafrodita';
  return gender;
}

export function CharacterCard({ character, onSelect }) {
  const monogram = getMonogram(character.name);
  const originPlanet = character.origin_planet || character.planet?.name || 'Desconocido';

  return (
    <button
      type="button"
      className="character-card"
      onClick={() => onSelect(character)}
      aria-label={`Ver detalles de ${character.name}`}
    >
      <div className="card-header">
        <div className="monogram-badge" aria-hidden="true">
          {monogram}
        </div>
        <div className="card-title-group">
          <h3 className="card-character-name" title={character.name}>
            {character.name}
          </h3>
          <span className="card-character-id">
            Registro #{String(character.id).padStart(3, '0')}
          </span>
        </div>
      </div>

      <div className="card-body">
        <div className="card-meta-row">
          <span className="card-meta-label">Género</span>
          <span className="card-meta-value">{formatGender(character.gender)}</span>
        </div>
        <div className="card-meta-row">
          <span className="card-meta-label">Año de nacimiento</span>
          <span className="card-meta-value">{character.birth_year || 'Desconocido'}</span>
        </div>
        <div className="card-meta-row">
          <span className="card-meta-label">Planeta de origen</span>
          <span className="card-meta-value">{originPlanet}</span>
        </div>
      </div>

      <div className="card-footer">
        <span className="card-action-hint">
          Consultar registro &rarr;
        </span>
      </div>
    </button>
  );
}
