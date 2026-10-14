import { config } from './config';
import app from './app';
import { prisma } from './db';
import { initDbCheck } from './dbCheck';

const server = app.listen(config.port, () => {
  console.log(`Server is running on http://localhost:${config.port}`);
});

const stopDbCheck = initDbCheck(prisma);

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down...`);
  stopDbCheck();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Don't hang forever on lingering keep-alive connections.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
