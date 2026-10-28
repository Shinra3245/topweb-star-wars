import { createClient } from '@supabase/supabase-js';

const SWAPI_BASE_URL = 'https://swapi.dev/api';
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 12000;

function extractIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/(\d+)\/?$/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return Number.isSafeInteger(id) ? id : null;
}

async function fetchWithRetry(url, attempt = 1) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const parsed = new URL(url);
    if (parsed.origin !== 'https://swapi.dev' || !parsed.pathname.startsWith('/api/')) throw new Error('URL de SWAPI no permitida');
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'StarWarsPracticeImporter/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Respuesta no exitosa de SWAPI: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.results)) {
      throw new Error(`Formato inesperado devuelto por SWAPI para ${url}`);
    }
    return data;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const delay = attempt * 1500;
      console.warn(`[Intento ${attempt}/${MAX_RETRIES}] Error al consultar ${url}: ${error.message}. Reintentando en ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, attempt + 1);
    }
    throw new Error(`Fallo definitivo al consultar ${url} tras ${MAX_RETRIES} intentos: ${error.message}`);
  }
}

async function fetchAllPages(endpoint) {
  const allResults = [];
  let nextUrl = `${SWAPI_BASE_URL}/${endpoint}/`;
  let pageNumber = 1;

  console.log(`Iniciando descarga paginada desde SWAPI: ${endpoint}...`);

  while (nextUrl) {
    console.log(`  Descargando página ${pageNumber} (${nextUrl})...`);
    if (pageNumber > 100) throw new Error('La paginación externa excede el límite esperado');
    const pageData = await fetchWithRetry(nextUrl);
    allResults.push(...pageData.results);
    nextUrl = pageData.next;
    pageNumber += 1;
  }

  console.log(`Total descargado de ${endpoint}: ${allResults.length} registros.`);
  return allResults;
}

async function runImport() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Faltan variables de entorno requeridas.');
    console.error('Asegúrese de definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exit(1);
  }

  console.log('Inicializando cliente de Supabase con service_role...');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  try {
    // Paso 1: Descargar y procesar planetas
    const rawPlanets = await fetchAllPages('planets');
    const planetsToUpsert = [];

    for (const p of rawPlanets) {
      const id = extractIdFromUrl(p.url);
      if (!id) {
        console.warn(`Omitiendo planeta sin ID extraíble: ${p.url}`);
        continue;
      }
      planetsToUpsert.push({
        id,
        name: p.name || 'Desconocido',
        source_url: p.url
      });
    }

    console.log(`Realizando upsert de ${planetsToUpsert.length} planetas en Supabase...`);
    const { error: planetError } = await supabase
      .from('planets')
      .upsert(planetsToUpsert, { onConflict: 'id' });

    if (planetError) {
      throw new Error(`Error en upsert de planetas: ${planetError.message}`);
    }
    console.log('Planetas sincronizados correctamente en la base de datos.');

    // Paso 2: Descargar y procesar personajes
    const rawPeople = await fetchAllPages('people');
    const charactersToUpsert = [];
    const nowIso = new Date().toISOString();

    for (const person of rawPeople) {
      const id = extractIdFromUrl(person.url);
      if (!id) {
        console.warn(`Omitiendo personaje sin ID extraíble: ${person.url}`);
        continue;
      }

      const planetId = extractIdFromUrl(person.homeworld);

      charactersToUpsert.push({
        id,
        name: person.name || 'Desconocido',
        gender: person.gender || 'n/a',
        birth_year: person.birth_year || 'unknown',
        height: person.height || 'unknown',
        mass: person.mass || 'unknown',
        eye_color: person.eye_color || 'unknown',
        hair_color: person.hair_color || 'unknown',
        planet_id: planetId,
        source_url: person.url,
        imported_at: nowIso
      });
    }

    console.log(`Realizando upsert de ${charactersToUpsert.length} personajes en Supabase...`);
    const { error: charError } = await supabase
      .from('characters')
      .upsert(charactersToUpsert, { onConflict: 'id' });

    if (charError) {
      throw new Error(`Error en upsert de personajes: ${charError.message}`);
    }
    console.log('Personajes sincronizados correctamente en la base de datos.');

    // Paso 3: Verificación de conteos finales en BD
    const { count: finalPlanetsCount, error: countPError } = await supabase
      .from('planets')
      .select('*', { count: 'exact', head: true });

    if (countPError) {
      throw new Error('No se pudo verificar el conteo persistido de planetas');
    }

    const { count: finalCharsCount, error: countCError } = await supabase
      .from('characters')
      .select('*', { count: 'exact', head: true });

    if (countCError) {
      throw new Error('No se pudo verificar el conteo persistido de personajes');
    }

    console.log('--------------------------------------------------');
    console.log('Resumen de importación SWAPI a Supabase:');
    console.log(`  Planetas en base de datos:   ${finalPlanetsCount ?? planetsToUpsert.length}`);
    console.log(`  Personajes en base de datos: ${finalCharsCount ?? charactersToUpsert.length}`);
    if (finalPlanetsCount !== planetsToUpsert.length || finalCharsCount !== charactersToUpsert.length) throw new Error('Los conteos persistidos no coinciden con los registros descargados');
    console.log('Importación completada; conteos persistidos verificados.');
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('Error durante la importación:', err.message);
    process.exit(1);
  }
}

runImport();
