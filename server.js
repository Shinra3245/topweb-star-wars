import { createApp } from './src/app.js';

const PORT = parseInt(process.env.PORT || '4310', 10);

const app = createApp({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Archivo Galáctico] Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`[Archivo Galáctico] URL base: http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
