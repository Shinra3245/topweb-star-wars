import React, { useEffect, useRef } from 'react';
import { getMonogram, formatGender } from './CharacterCard.jsx';

function formatMeasurement(value, unit) {
  if (!value || value === 'unknown' || value === 'n/a') {
    return 'Desconocido';
  }
  return `${value} ${unit}`.trim();
}

function translateFeature(value) {
  if (!value || value === 'unknown' || value === 'n/a' || value === 'none') {
    return 'Ninguno / Desconocido';
  }
  const dict = {
    blue: 'Azul',
    brown: 'Marrón',
    black: 'Negro',
    hazel: 'Avellana',
    yellow: 'Amarillo',
    red: 'Rojo',
    blond: 'Rubio',
    blonde: 'Rubio',
    grey: 'Gris',
    gray: 'Gris',
    white: 'Blanco',
    auburn: 'Castaño rojizo'
  };
  return dict[value.toLowerCase()] || value;
}

export function CharacterDetailModal({ character, onClose }) {
  const triggerElementRef = useRef(null);
  const closeButtonRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    // Guardar el elemento que disparó la apertura del modal para restaurar foco
    triggerElementRef.current = document.activeElement;

    // Bloquear scroll del documento
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Foco inicial en el botón de cerrar
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        const controls = overlayRef.current?.querySelectorAll('button:not([disabled]), a[href], input, [tabindex="0"]');
        const first = controls?.[0]; const last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      // Restaurar foco al elemento que abrió el modal
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus();
      }
    };
  }, [onClose]);

  if (!character) return null;

  const monogram = getMonogram(character.name);
  const originPlanet = character.origin_planet || character.planet?.name || 'Desconocido';

  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-character-title"
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-monogram" aria-hidden="true">
              {monogram}
            </div>
            <div>
              <h2 id="modal-character-title" className="modal-character-name">
                {character.name}
              </h2>
              <span className="modal-tag">
                Ficha Técnica Galáctica #{String(character.id).padStart(3, '0')}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn-close-modal"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Cerrar modal de detalles"
            title="Cerrar (Escape)"
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-spec-grid">
            <div className="spec-item">
              <span className="spec-label">Planeta de Origen</span>
              <span className="spec-value">{originPlanet}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Año de Nacimiento</span>
              <span className="spec-value">{character.birth_year || 'Desconocido'}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Altura</span>
              <span className="spec-value">{formatMeasurement(character.height, 'cm')}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Peso / Masa</span>
              <span className="spec-value">{formatMeasurement(character.mass, 'kg')}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Color de Ojos</span>
              <span className="spec-value">{translateFeature(character.eye_color)}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Color de Cabello</span>
              <span className="spec-value">{translateFeature(character.hair_color)}</span>
            </div>

            <div className="spec-item spec-item-full">
              <span className="spec-label">Género Registrado</span>
              <span className="spec-value">{formatGender(character.gender)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {character.source_url ? (
            <span className="modal-source-link">
              Fuente de origen: SWAPI ({character.source_url.replace('https://swapi.dev/api/', '')})
            </span>
          ) : <span />}

          <button
            type="button"
            className="btn-modal-dismiss"
            onClick={onClose}
          >
            Cerrar ficha
          </button>
        </div>
      </div>
    </div>
  );
}
