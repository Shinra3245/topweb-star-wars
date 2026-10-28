# Archivo Galáctico — Star Wars

Práctica integradora de Tópicos Avanzados de Desarrollo Web. Galería de personajes con acceso OAuth mediante GitHub, paginación, búsqueda y ficha de detalle.

## Arquitectura

```text
SWAPI → importador Node.js → Supabase local (PostgreSQL)
                                  ↓
                          API propia Express
                                  ↓
                            React + Vite
```

El navegador consulta los personajes exclusivamente mediante `/api/characters`; el backend lee Supabase usando la sesión del usuario y RLS. El navegador también se comunica con Supabase Auth para iniciar y mantener la sesión. SWAPI solo se consulta durante la importación.

## Requisitos

- Node.js 24 y npm.
- Docker en ejecución y puertos disponibles.
- Una aplicación OAuth de GitHub propia.

## Instalación y ejecución local

```bash
npm ci
cp .env.example .env
```

Configure `GITHUB_CLIENT_ID` y `GITHUB_SECRET` en `.env`. Registre la aplicación OAuth en GitHub con:

- Página principal: `http://localhost:4310`
- Callback del proveedor: `http://127.0.0.1:54341/auth/v1/callback`

```bash
npm run db:start
npx supabase status
```

Copie a `.env` las claves locales públicas y administrativas correspondientes a `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Mantenga este archivo privado. El inicio inicial aplica las migraciones de `supabase/migrations/`; para aplicar nuevas migraciones sin borrar datos use `npx supabase migration up --local`.

```bash
npm run import
npm run build
npm start
```

Abra **http://localhost:4310**. Para detener únicamente la base de datos de esta práctica use `npm run db:stop`. La configuración excluye servicios opcionales para reducir el consumo de memoria. No requiere despliegue público ni un proyecto de pago.

Para desarrollar el frontend puede ejecutar `npm run dev` en otra terminal; el servidor Express debe seguir activo. Vite utiliza el puerto 5310 y un proxy hacia `/api`.

## Puertos

| Servicio | Puerto |
|---|---:|
| Aplicación Express y frontend compilado | 4310 |
| Vite, opcional | 5310 |
| Supabase API y Auth | 54341 |
| PostgreSQL | 54342 |

## Modelo de datos

- `planets`: identificador de SWAPI, nombre y URL de origen única.
- `characters`: identificador, nombre, género, año de nacimiento, altura, masa, ojos, cabello, planeta relacionado, URL única y fecha de importación.

Se conservaron como texto los atributos que admiten valores desconocidos o años como `19BBY`. Las claves primarias, URLs únicas y la relación con planetas evitan duplicados y referencias inconsistentes.

RLS permite lectura únicamente a usuarios autenticados. Los usuarios no tienen permisos para modificar el catálogo. La clave administrativa solo se utiliza en el importador y nunca se entrega al frontend.

## Proceso de carga

`npm run import` recorre las páginas de planetas y personajes de SWAPI, guarda primero los planetas y después los personajes mediante `upsert`. Comprueba los conteos persistidos y dispone de reintentos y límites de tiempo. Puede ejecutarse nuevamente para actualizar los registros.

## API propia

| Ruta | Acceso |
|---|---|
| `GET /api/health` | Público, disponibilidad del servidor |
| `GET /api/config` | Público, configuración pública de Auth |
| `GET /api/characters?page=1&pageSize=12&q=Luke` | Sesión OAuth válida |
| `GET /api/characters/1` | Sesión OAuth válida |

El tamaño de página admite de 1 a 24 registros. La búsqueda admite hasta 100 caracteres. Las solicitudes inválidas, no autorizadas y sin resultados se manejan explícitamente.

## Comprobaciones realizadas

- Compilación del frontend correcta.
- 20 pruebas automatizadas del backend aprobadas.
- Dos importaciones reales: 60 planetas y 82 personajes, sin duplicados.
- Integridad de la relación de planetas y permisos de lectura/escritura comprobados en PostgreSQL.
- Pantalla local de acceso capturada en `evidencias/01_acceso_oauth.png`.
- **Pendiente:** completar acceso OAuth en navegador y validar galería, navegación, detalle y diseño móvil con sesión real.

```bash
npm run build
npm test
```

Los resultados del backend y las importaciones están en `evidencias/`. Las pruebas de backend usan servicios controlados y no sustituyen la comprobación del flujo OAuth real.

## Fuentes

- [SWAPI](https://swapi.dev/documentation)
- [Supabase local](https://supabase.com/docs/guides/local-development)
- [OAuth con GitHub en Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-github)

Proyecto académico sin afiliación con Lucasfilm.
