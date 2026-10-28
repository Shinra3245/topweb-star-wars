import express from 'express';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

/**
 * Crea la aplicación Express con dependencias inyectables para pruebas y producción.
 *
 * @param {Object} options
 * @param {string} [options.supabaseUrl]
 * @param {string} [options.supabaseAnonKey]
 * @param {Object} [options.authService] - Proveedor de autenticación opcional para testing
 * @param {Object} [options.characterService] - Servicio de personajes opcional para testing
 * @param {string} [options.distPath] - Directorio de archivos estáticos del frontend
 * @returns {express.Application}
 */
export function createApp(options = {}) {
  const {
    supabaseUrl = process.env.SUPABASE_URL,
    supabaseAnonKey = process.env.SUPABASE_ANON_KEY,
    authService,
    characterService,
    distPath = path.resolve(process.cwd(), 'dist')
  } = options;

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  // Endpoint de salud
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'archivo-galactico-api',
      timestamp: new Date().toISOString()
    });
  });

  // Configuración pública de Supabase necesaria para el flujo OAuth en el frontend
  app.get('/api/config', (req, res) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(503).json({
        error: 'Configuración de Supabase no disponible en las variables de entorno del servidor'
      });
    }

    res.json({
      supabaseUrl,
      supabaseAnonKey
    });
  });

  // Middleware de autenticación Bearer
  const requireAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({
        error: 'No autorizado: token de acceso no proporcionado'
      });
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({
        error: 'No autorizado: formato de autorización inválido'
      });
    }

    const token = match[1].trim();
    if (!token) {
      return res.status(401).json({
        error: 'No autorizado: token de acceso vacío'
      });
    }

    try {
      if (authService) {
        const { user, error } = await authService.getUser(token);
        if (error || !user) {
          return res.status(401).json({
            error: 'No autorizado: sesión inválida o expirada'
          });
        }
        req.user = user;
        req.authToken = token;
        return next();
      }

      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(503).json({
          error: 'Servicio no disponible: configuración de autenticación no inicializada'
        });
      }

      // Validar el token contra Supabase con la anon key
      const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data: { user } = {}, error } = await supabaseAuthClient.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({
          error: 'No autorizado: sesión inválida o expirada'
        });
      }

      req.user = user;
      req.authToken = token;
      return next();
    } catch {
      return res.status(401).json({
        error: 'No autorizado: no se pudo verificar la sesión'
      });
    }
  };

  // Helper para instanciar cliente Supabase con el Bearer token del usuario autenticado (RLS)
  const getUserSupabaseClient = (token) => {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
  };

  // GET /api/characters?page=1&pageSize=12&q=...
  app.get('/api/characters', requireAuth, async (req, res) => {
    let page = 1;
    let pageSize = 12;
    let q = '';

    if (req.query.page !== undefined) {
      if (typeof req.query.page !== 'string' || !/^\d+$/.test(req.query.page)) {
        return res.status(400).json({
          error: 'El parámetro "page" debe ser un número entero mayor o igual a 1'
        });
      }
      page = parseInt(String(req.query.page), 10);
      if (!Number.isSafeInteger(page) || page < 1) {
        return res.status(400).json({
          error: 'El parámetro "page" debe ser un número entero mayor o igual a 1'
        });
      }
    }

    if (req.query.pageSize !== undefined) {
      if (typeof req.query.pageSize !== 'string' || !/^\d+$/.test(req.query.pageSize)) {
        return res.status(400).json({
          error: 'El parámetro "pageSize" debe ser un número entero entre 1 y 24'
        });
      }
      pageSize = parseInt(String(req.query.pageSize), 10);
      if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 24) {
        return res.status(400).json({
          error: 'El parámetro "pageSize" debe ser un número entero entre 1 y 24'
        });
      }
    }

    if (req.query.q !== undefined) {
      if (typeof req.query.q !== 'string' || req.query.q.length > 100) {
        return res.status(400).json({
          error: 'El parámetro de búsqueda "q" no debe exceder 100 caracteres'
        });
      }
      q = req.query.q.trim();
    }

    if (!Number.isSafeInteger((page - 1) * pageSize + pageSize - 1)) {
      return res.status(400).json({ error: 'La página solicitada excede el rango permitido' });
    }

    try {
      if (characterService) {
        const result = await characterService.list({ page, pageSize, q, user: req.user, token: req.authToken });
        return res.json(result);
      }

      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(503).json({
          error: 'Configuración de base de datos no disponible'
        });
      }

      const userClient = getUserSupabaseClient(req.authToken);
      let query = userClient
        .from('characters')
        .select(`
          id,
          name,
          gender,
          birth_year,
          height,
          mass,
          eye_color,
          hair_color,
          planet_id,
          source_url,
          planets (
            id,
            name
          )
        `, { count: 'exact' });

      if (q) {
        query = query.ilike('name', `%${q}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query
        .order('id', { ascending: true })
        .range(from, to);

      const { data, count, error } = await query;

      if (error) {
        return res.status(503).json({
          error: 'Error al consultar el repositorio de datos galácticos'
        });
      }

      const items = (data || []).map((char) => ({
        id: char.id,
        name: char.name,
        gender: char.gender,
        birth_year: char.birth_year,
        height: char.height,
        mass: char.mass,
        eye_color: char.eye_color,
        hair_color: char.hair_color,
        planet_id: char.planet_id,
        source_url: char.source_url,
        origin_planet: char.planets?.name || 'Desconocido',
        planet: char.planets ? { id: char.planets.id, name: char.planets.name } : null
      }));

      const total = count ?? 0;
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

      return res.json({
        items,
        total,
        page,
        pageSize,
        totalPages
      });
    } catch {
      return res.status(503).json({
        error: 'Error interno al procesar la solicitud de personajes'
      });
    }
  });

  // GET /api/characters/:id
  app.get('/api/characters/:id', requireAuth, async (req, res) => {
    const rawId = req.params.id;
    if (!/^\d+$/.test(rawId)) {
      return res.status(400).json({
        error: 'El identificador de personaje debe ser un número entero válido'
      });
    }

    const id = parseInt(rawId, 10);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        error: 'El identificador de personaje debe ser un número entero válido'
      });
    }

    try {
      if (characterService) {
        const character = await characterService.getById(id, { user: req.user, token: req.authToken });
        if (!character) {
          return res.status(404).json({
            error: 'Personaje no encontrado'
          });
        }
        return res.json(character);
      }

      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(503).json({
          error: 'Configuración de base de datos no disponible'
        });
      }

      const userClient = getUserSupabaseClient(req.authToken);
      const { data, error } = await userClient
        .from('characters')
        .select(`
          id,
          name,
          gender,
          birth_year,
          height,
          mass,
          eye_color,
          hair_color,
          planet_id,
          source_url,
          planets (
            id,
            name
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return res.status(503).json({
          error: 'Error al consultar el personaje solicitado'
        });
      }

      if (!data) {
        return res.status(404).json({
          error: 'Personaje no encontrado'
        });
      }

      return res.json({
        id: data.id,
        name: data.name,
        gender: data.gender,
        birth_year: data.birth_year,
        height: data.height,
        mass: data.mass,
        eye_color: data.eye_color,
        hair_color: data.hair_color,
        planet_id: data.planet_id,
        source_url: data.source_url,
        origin_planet: data.planets?.name || 'Desconocido',
        planet: data.planets ? { id: data.planets.id, name: data.planets.name } : null
      });
    } catch {
      return res.status(503).json({
        error: 'Error interno al consultar el personaje'
      });
    }
  });

  // Manejador para rutas /api no encontradas
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'Ruta de API no encontrada'
    });
  });

  // Servir frontend compilado (SPA) si dist existe
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}
