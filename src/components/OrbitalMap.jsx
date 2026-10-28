import React from 'react';

/**
 * Mapa orbital discreto en SVG para el fondo de la pantalla de bienvenida.
 */
export function OrbitalMap() {
  return (
    <svg
      className="orbital-map-bg"
      viewBox="0 0 800 800"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Ejes de coordenadas galácticas */}
      <line x1="400" y1="50" x2="400" y2="750" className="orbital-axis" />
      <line x1="50" y1="400" x2="750" y2="400" className="orbital-axis" />
      <line x1="150" y1="150" x2="650" y2="650" className="orbital-axis" strokeDasharray="3 9" />
      <line x1="650" y1="150" x2="150" y2="650" className="orbital-axis" strokeDasharray="3 9" />

      {/* Anillos orbitales concéntricos */}
      <circle cx="400" cy="400" r="100" className="orbital-ring" />
      <circle cx="400" cy="400" r="200" className="orbital-ring-gold" />
      <circle cx="400" cy="400" r="300" className="orbital-ring" />
      <circle cx="400" cy="400" r="360" className="orbital-ring-gold" />

      {/* Nodos planetarios / estaciones espaciales discretas */}
      <circle cx="400" cy="400" r="4" fill="#f4d35e" />
      <circle cx="400" cy="200" r="3.5" className="orbital-node" />
      <circle cx="541" cy="259" r="3" fill="#f4d35e" />
      <circle cx="700" cy="400" r="4" className="orbital-node" />
      <circle cx="188" cy="188" r="3" className="orbital-node" />
      <circle cx="250" cy="550" r="3.5" fill="#f4d35e" />
      <circle cx="612" cy="520" r="3" className="orbital-node" />
    </svg>
  );
}
