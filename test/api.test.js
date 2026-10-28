import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

// Mock del servicio de autenticación para pruebas
const mockValidToken = 'valid-test-token-12345';
const mockUser = {
  id: 'usr-1111-2222',
  email: 'jedi@galaxy.org'
};

const mockAuthService = {
  getUser: async (token) => {
    if (token === mockValidToken) {
      return { user: mockUser, error: null };
    }
    return { user: null, error: new Error('Token inválido') };
  }
};

// Mock de datos de personajes
const mockCharacters = [
  {
    id: 1,
    name: 'Luke Skywalker',
    gender: 'male',
    birth_year: '19BBY',
    height: '172',
    mass: '77',
    eye_color: 'blue',
    hair_color: 'blond',
    planet_id: 1,
    source_url: 'https://swapi.dev/api/people/1/',
    origin_planet: 'Tatooine',
    planet: { id: 1, name: 'Tatooine' }
  },
  {
    id: 2,
    name: 'C-3PO',
    gender: 'n/a',
    birth_year: '112BBY',
    height: '167',
    mass: '75',
    eye_color: 'yellow',
    hair_color: 'n/a',
    planet_id: 1,
    source_url: 'https://swapi.dev/api/people/2/',
    origin_planet: 'Tatooine',
    planet: { id: 1, name: 'Tatooine' }
  }
];

const mockCharacterService = {
  list: async ({ page = 1, pageSize = 12, q = '' }) => {
    let filtered = mockCharacters;
    if (q) {
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    }
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    return { items, total, page, pageSize, totalPages };
  },
  getById: async (id) => {
    const found = mockCharacters.find((c) => c.id === id);
    return found || null;
  }
};

describe('API de Archivo Galáctico', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp({
      supabaseUrl: 'http://127.0.0.1:54341',
      supabaseAnonKey: 'mock-anon-key-public',
      authService: mockAuthService,
      characterService: mockCharacterService
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('GET /api/health', () => {
    it('debe responder 200 con estado ok sin filtrar información sensible', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.service, 'archivo-galactico-api');
      assert.ok(data.timestamp);
    });
  });

  describe('GET /api/config', () => {
    it('debe responder 200 con supabaseUrl y supabaseAnonKey públicas', async () => {
      const res = await fetch(`${baseUrl}/api/config`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.supabaseUrl, 'http://127.0.0.1:54341');
      assert.equal(data.supabaseAnonKey, 'mock-anon-key-public');
      assert.equal(data.SUPABASE_SERVICE_ROLE_KEY, undefined);
      assert.equal(data.GITHUB_SECRET, undefined);
    });

    it('debe responder 503 con mensaje en español cuando falta la configuración', async () => {
      const unconfiguredApp = createApp({
        supabaseUrl: '',
        supabaseAnonKey: ''
      });
      const unconfiguredServer = await new Promise((resolve) => {
        const s = unconfiguredApp.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = unconfiguredServer.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/config`);
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.match(data.error, /Configuración de Supabase no disponible/);
      } finally {
        await new Promise((resolve) => unconfiguredServer.close(resolve));
      }
    });
  });

  describe('Autenticación (401)', () => {
    it('debe responder 401 si no se envía la cabecera Authorization', async () => {
      const res = await fetch(`${baseUrl}/api/characters`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /token de acceso no proporcionado/i);
    });

    it('debe responder 401 si el esquema no es Bearer', async () => {
      const res = await fetch(`${baseUrl}/api/characters`, {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' }
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /formato de autorización inválido/i);
    });

    it('debe responder 401 si el token es inválido o expirado', async () => {
      const res = await fetch(`${baseUrl}/api/characters`, {
        headers: { Authorization: 'Bearer token-invalido-o-expirado' }
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /sesión inválida o expirada/i);
    });
  });

  describe('Validación de Parámetros (400)', () => {
    it('debe responder 400 si page no es un entero positivo válido', async () => {
      const res = await fetch(`${baseUrl}/api/characters?page=0`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /"page" debe ser un número entero mayor o igual a 1/);

      const resString = await fetch(`${baseUrl}/api/characters?page=invalido`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(resString.status, 400);
    });

    it('rechaza páginas repetidas y rangos que exceden enteros seguros', async () => {
      for (const query of ['page=1&page=2', 'page=9007199254740991&pageSize=24']) {
        const response = await fetch(`${baseUrl}/api/characters?${query}`, { headers: { Authorization: `Bearer ${mockValidToken}` } });
        assert.equal(response.status, 400);
        await response.json();
      }
    });

    it('debe responder 400 si pageSize no está entre 1 y 24', async () => {
      const resZero = await fetch(`${baseUrl}/api/characters?pageSize=0`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(resZero.status, 400);
      const dataZero = await resZero.json();
      assert.match(dataZero.error, /"pageSize" debe ser un número entero entre 1 y 24/);

      const resBig = await fetch(`${baseUrl}/api/characters?pageSize=25`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(resBig.status, 400);
      const dataBig = await resBig.json();
      assert.match(dataBig.error, /"pageSize" debe ser un número entero entre 1 y 24/);
    });

    it('debe responder 400 si q excede los 100 caracteres', async () => {
      const longQuery = 'a'.repeat(101);
      const res = await fetch(`${baseUrl}/api/characters?q=${longQuery}`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /"q" no debe exceder 100 caracteres/);
    });

    it('debe responder 400 si el id en /api/characters/:id no es numérico seguro', async () => {
      const res = await fetch(`${baseUrl}/api/characters/abc`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /identificador de personaje debe ser un número entero/);
    });
  });

  describe('Listado y Detalle de Personajes (200 y 404)', () => {
    it('debe devolver listado paginado con items, total, page, pageSize, totalPages', async () => {
      const res = await fetch(`${baseUrl}/api/characters?page=1&pageSize=12`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(Array.isArray(data.items), true);
      assert.equal(data.total, 2);
      assert.equal(data.page, 1);
      assert.equal(data.pageSize, 12);
      assert.equal(data.totalPages, 1);
      assert.equal(data.items[0].name, 'Luke Skywalker');
      assert.equal(data.items[0].origin_planet, 'Tatooine');
    });

    it('debe filtrar correctamente mediante el parámetro q', async () => {
      const res = await fetch(`${baseUrl}/api/characters?q=Luke`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.items.length, 1);
      assert.equal(data.items[0].name, 'Luke Skywalker');
    });

    it('debe devolver detalle del personaje solicitado por ID', async () => {
      const res = await fetch(`${baseUrl}/api/characters/1`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(res.status, 200);
      const char = await res.json();
      assert.equal(char.id, 1);
      assert.equal(char.name, 'Luke Skywalker');
      assert.equal(char.gender, 'male');
      assert.equal(char.birth_year, '19BBY');
      assert.equal(char.height, '172');
      assert.equal(char.mass, '77');
      assert.equal(char.eye_color, 'blue');
      assert.equal(char.hair_color, 'blond');
      assert.equal(char.origin_planet, 'Tatooine');
    });

    it('debe responder 404 si el personaje no existe', async () => {
      const res = await fetch(`${baseUrl}/api/characters/999`, {
        headers: { Authorization: `Bearer ${mockValidToken}` }
      });
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.match(data.error, /Personaje no encontrado/);
    });
  });

  describe('Manejo de Errores de Base de Datos / Servicios (503)', () => {
    it('debe responder 503 sin filtrar errores internos cuando el servicio falla en listado', async () => {
      const failingCharacterService = {
        list: async () => {
          throw new Error('Postgres connection pool exhausted');
        },
        getById: async () => null
      };

      const failingApp = createApp({
        supabaseUrl: 'http://127.0.0.1:54341',
        supabaseAnonKey: 'mock-key',
        authService: mockAuthService,
        characterService: failingCharacterService
      });
      const failingServer = await new Promise((resolve) => {
        const s = failingApp.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = failingServer.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/characters`, {
          headers: { Authorization: `Bearer ${mockValidToken}` }
        });
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.ok(data.error);
        // Verificar que no se expone el mensaje interno "Postgres connection pool exhausted"
        assert.equal(data.error.includes('Postgres connection pool exhausted'), false);
        assert.match(data.error, /Error interno/);
      } finally {
        await new Promise((resolve) => failingServer.close(resolve));
      }
    });

    it('debe responder 503 sin filtrar errores internos cuando el servicio falla en detalle', async () => {
      const failingCharacterService = {
        list: async () => ({ items: [], total: 0 }),
        getById: async () => {
          throw new Error('Database disk I/O failure');
        }
      };

      const failingApp = createApp({
        supabaseUrl: 'http://127.0.0.1:54341',
        supabaseAnonKey: 'mock-key',
        authService: mockAuthService,
        characterService: failingCharacterService
      });
      const failingServer = await new Promise((resolve) => {
        const s = failingApp.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = failingServer.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/characters/1`, {
          headers: { Authorization: `Bearer ${mockValidToken}` }
        });
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.ok(data.error);
        assert.equal(data.error.includes('Database disk I/O failure'), false);
        assert.match(data.error, /Error interno/);
      } finally {
        await new Promise((resolve) => failingServer.close(resolve));
      }
    });
  });

  describe('Servicio de Frontend y Fallback SPA', () => {
    it('debe responder 404 en formato JSON ante rutas de /api inexistentes', async () => {
      const res = await fetch(`${baseUrl}/api/ruta-desconocida`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.match(data.error, /Ruta de API no encontrada/);
    });

    it('debe servir el archivo index.html para la raíz / cuando dist existe', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.match(text, /<!DOCTYPE html>/i);
      assert.match(text, /Archivo Galáctico/);
    });

    it('debe realizar fallback a index.html para rutas SPA como /auth/callback', async () => {
      const res = await fetch(`${baseUrl}/auth/callback`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.match(text, /<!DOCTYPE html>/i);
    });
  });
});
