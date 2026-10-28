import React from 'react';

export function Navbar({ user, onSignOut }) {
  const userName =
    user?.user_metadata?.user_name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'Oficial Galáctico';

  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand-wrapper">
          <div className="brand-emblem" aria-hidden="true">AG</div>
          <div>
            <h1 className="brand-title">Archivo Galáctico</h1>
            <span className="brand-subtitle">Terminal de Registro</span>
          </div>
        </div>

        <div className="user-profile">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${userName}`}
              className="user-avatar"
            />
          ) : (
            <div className="brand-emblem" style={{ width: 32, height: 32, fontSize: 12 }}>
              {userName.substring(0, 2).toUpperCase()}
            </div>
          )}

          <div className="user-meta">
            <span className="user-name">{userName}</span>
            <span className="user-badge">Identidad Verificada</span>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="btn-signout"
            title="Finalizar sesión actual"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
