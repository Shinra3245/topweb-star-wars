import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeAuth } from './auth.js';
import { Navbar } from './components/Navbar.jsx';
import { OrbitalMap } from './components/OrbitalMap.jsx';
import { SearchAndPagination } from './components/SearchAndPagination.jsx';
import { CharacterCard } from './components/CharacterCard.jsx';
import { CharacterDetailModal } from './components/CharacterDetailModal.jsx';
import { SkeletonGrid } from './components/SkeletonGrid.jsx';

export function App() {
  // Estado de configuración y cliente Supabase
  const [supabaseClient, setSupabaseClient] = useState(null);
  const [configError, setConfigError] = useState(null);

  // Estado de autenticación
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  // Estado de datos de personajes
  const [characters, setCharacters] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Modal de detalle
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  useEffect(() => {
    let active = true;
    let subscription;
    initializeAuth().then(({ client, session: initialSession, authError: error }) => {
      if (!active) return;
      setSupabaseClient(client);
      setSession(initialSession);
      setAuthError(error);
      setLoadingAuth(false);
      subscription = client.auth.onAuthStateChange((_event, nextSession) => {
        if (active) { setSession(nextSession); setLoadingAuth(false); }
      }).data.subscription;
    }).catch((error) => {
      if (active) { setConfigError(error.message); setLoadingAuth(false); }
    });
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);

  // 2. Debounce del parámetro de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1); // Reiniciar a la primera página con cada nueva búsqueda
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. Consulta de personajes con cancelación mediante AbortController
  useEffect(() => {
    if (!session?.access_token) {
      setCharacters([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }

    const controller = new AbortController();
    setLoadingData(true);
    setDataError(null);

    const queryParams = new URLSearchParams({
      page: String(page),
      pageSize: '12'
    });

    if (debouncedQuery) {
      queryParams.set('q', debouncedQuery);
    }

    fetch(`/api/characters?${queryParams.toString()}`, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error al consultar personajes (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setCharacters(data.items || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setLoadingData(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          // Solicitud cancelada por cambio de página o búsqueda; no se considera error
          return;
        }
        setDataError(err.message || 'No fue posible cargar el registro de personajes.');
        setLoadingData(false);
      });

    return () => {
      controller.abort();
    };
  }, [session, page, debouncedQuery, retryTrigger]);

  // Manejador de inicio de sesión con GitHub (OAuth con PKCE)
  const handleSignIn = async () => {
    if (!supabaseClient) return;
    setSigningIn(true);
    setAuthError(null);

    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUri
        }
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      setAuthError(err.message || 'Error al conectar con el proveedor de autenticación GitHub.');
      setSigningIn(false);
    }
  };

  // Manejador de cierre de sesión
  const handleSignOut = async () => {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
    if (error) { setDataError('No se pudo cerrar la sesión. Intenta de nuevo.'); return; }
    setSelectedCharacter(null);
    setSearchQuery('');
    setPage(1);
    setSession(null);
  };

  // Reintentar consulta de personajes
  const handleRetry = useCallback(() => {
    setRetryTrigger((prev) => prev + 1);
  }, []);

  // Pantalla de error si falta la configuración de Supabase en el servidor
  if (configError) {
    return (
      <div className="login-view">
        <OrbitalMap />
        <div className="login-card">
          <div className="login-emblem" aria-hidden="true">AG</div>
          <h1 className="login-title">Archivo Galáctico</h1>
          <p className="login-subtitle">Error de Inicialización</p>
          <div className="state-message-panel error" style={{ margin: '1rem 0' }}>
            <p className="state-title">Servicio no configurado</p>
            <p className="state-description">{configError}</p>
          </div>
          <p className="login-note">
            Verifique que el backend esté ejecutándose con las variables de entorno requeridas en el archivo .env.
          </p>
        </div>
      </div>
    );
  }

  // Pantalla de carga mientras se resuelve la sesión inicial
  if (loadingAuth) {
    return (
      <div className="login-view">
        <OrbitalMap />
        <div className="login-card">
          <div className="login-emblem" aria-hidden="true">AG</div>
          <h1 className="login-title">Archivo Galáctico</h1>
          <p className="login-subtitle">Verificando credenciales galácticas...</p>
        </div>
      </div>
    );
  }

  // Pantalla de inicio de sesión si no hay usuario autenticado
  if (!session) {
    return (
      <div className="login-view">
        <OrbitalMap />
        <main className="login-card">
          <div className="login-emblem" aria-hidden="true">AG</div>
          <h1 className="login-title">Archivo Galáctico</h1>
          <p className="login-subtitle">Personajes de una galaxia muy, muy lejana</p>

          <p className="login-description">
            Explora personajes, descubre su planeta de origen y consulta sus historias en una sola galería. Inicia sesión para abrir el archivo.
          </p>

          {authError && (
            <div className="state-message-panel error" style={{ margin: '1rem 0', padding: '1rem' }}>
              <p className="state-description" style={{ color: 'var(--color-error)', margin: 0 }}>
                {authError}
              </p>
            </div>
          )}

          <button
            type="button"
            className="btn-github"
            onClick={handleSignIn}
            disabled={signingIn}
            aria-label="Acceder con cuenta de GitHub"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {signingIn ? 'Redirigiendo a GitHub...' : 'Acceder con GitHub'}
          </button>

          <p className="login-note">
            Usa tu cuenta de GitHub para entrar al archivo.
          </p>
        </main>
      </div>
    );
  }

  // Vista principal autenticada
  return (
    <div className="app-container">
      <Navbar user={session.user} onSignOut={handleSignOut} />

      <main className="main-content">
        <SearchAndPagination
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          page={page}
          totalPages={totalPages}
          total={total}
          onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
          isLoading={loadingData}
        />

        <section className="gallery-section">
          <div className="gallery-section-header">
            <h2 className="gallery-title">Personajes de la galaxia</h2>
            {debouncedQuery && (
              <span className="stats-count">
                Filtro activo: &ldquo;{debouncedQuery}&rdquo;
              </span>
            )}
          </div>

          {loadingData ? (
            <SkeletonGrid count={12} />
          ) : dataError ? (
            <div className="state-message-panel error" role="alert">
              <h3 className="state-title">Error al consultar datos</h3>
              <p className="state-description">{dataError}</p>
              <button type="button" className="btn-retry" onClick={handleRetry}>
                Reintentar consulta
              </button>
            </div>
          ) : characters.length === 0 ? (
            <div className="state-message-panel">
              <h3 className="state-title">Sin registros encontrados</h3>
              <p className="state-description">
                {debouncedQuery
                  ? `No se hallaron personajes que coincidan con "${debouncedQuery}". Intente con otro término.`
                  : 'No hay personajes disponibles en el archivo galáctico.'}
              </p>
              {debouncedQuery && (
                <button
                  type="button"
                  className="btn-retry"
                  onClick={() => setSearchQuery('')}
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <div className="gallery-grid">
              {characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onSelect={setSelectedCharacter}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>Archivo Galáctico · Universo Star Wars</p>
      </footer>

      {selectedCharacter && (
        <CharacterDetailModal
          character={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
        />
      )}
    </div>
  );
}
