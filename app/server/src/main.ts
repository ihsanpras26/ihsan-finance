// main.ts: bootstrap: config, database, HTTP server, background scheduler.
import { config } from './config.ts';
import { migrate, openDatabase } from './db/index.ts';
import { buildServer } from './http/server.ts';

async function main(): Promise<void> {
  const db = await openDatabase(config.dbUrl ?? config.dbPath, config.dbToken || undefined);
  await migrate(db);

  const app = await buildServer({ db });

  await app.listen({ port: config.port, host: config.host });
  // Keep the log line free of money, notes, and third-party names (NFR08).
  console.log(`Ihsan Finance API siap di http://${config.host}:${config.port} (basis data: ${config.dbUrl ?? config.dbPath})`);

  let timer: NodeJS.Timeout | null = null;
  try {
    const { runScheduler } = await import('./workers/scheduler.ts');
    const tick = async () => {
      try {
        const result = await runScheduler(db, { today: undefined });
        if (result.occurrencesCreated > 0 || result.notificationsCreated > 0) {
          console.log(`Penjadwal: ${result.occurrencesCreated} kejadian berulang, ${result.notificationsCreated} pengingat baru.`);
        }
      } catch (error) {
        console.error('Penjadwal gagal dijalankan:', error instanceof Error ? error.message : error);
      }
    };
    await tick();
    timer = setInterval(tick, 15 * 60 * 1000);
  } catch (error) {
    console.warn('Modul penjadwal belum tersedia:', error instanceof Error ? error.message : error);
  }

  const shutdown = async (signal: string) => {
    console.log(`Menerima ${signal}, menutup server.`);
    if (timer) clearInterval(timer);
    await app.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Server gagal dijalankan:', error);
  process.exit(1);
});
