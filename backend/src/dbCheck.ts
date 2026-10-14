import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

// Supabase pauses free-tier projects after a week of inactivity; pinging every few days keeps it awake.
const CHECK_INTERVAL = 5 * 24 * 60 * 60 * 1000; // 5 days
const POLL_INTERVAL = 60 * 60 * 1000; // 1 hour
const FILE_PATH = path.join(process.cwd(), '.dbcheck.json');

export interface CheckStatus {
  isOkay: boolean;
  lastCheck: string | null;
}

const loadStatus = (): CheckStatus => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
    const candidate = parsed as Partial<CheckStatus>;
    if (typeof candidate?.isOkay === 'boolean' && (typeof candidate.lastCheck === 'string' || candidate.lastCheck === null)) {
      return { isOkay: candidate.isOkay, lastCheck: candidate.lastCheck };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to read .dbcheck.json', error);
    }
  }
  return { isOkay: false, lastCheck: null };
};

let currentStatus: CheckStatus = loadStatus();

export const getDbStatus = (): CheckStatus => currentStatus;

/** Starts the periodic database ping. Returns a function that stops it. */
export const initDbCheck = (prisma: PrismaClient): (() => void) => {
  let running = false;

  const performCheck = async () => {
    running = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
      currentStatus = { isOkay: true, lastCheck: new Date().toISOString() };
      console.log('Database check successful');
    } catch (error) {
      console.error('Database check failed:', error);
      currentStatus = { isOkay: false, lastCheck: new Date().toISOString() };
    } finally {
      running = false;
    }

    try {
      fs.writeFileSync(FILE_PATH, JSON.stringify(currentStatus));
    } catch (error) {
      console.error('Failed to write .dbcheck.json', error);
    }
  };

  const checkAndRun = () => {
    const lastCheckTime = currentStatus.lastCheck ? new Date(currentStatus.lastCheck).getTime() : 0;
    if (!running && Date.now() - lastCheckTime >= CHECK_INTERVAL) {
      void performCheck();
    }
  };

  checkAndRun();

  // unref() so the timer never keeps the process alive on its own.
  const timer = setInterval(checkAndRun, POLL_INTERVAL);
  timer.unref();
  return () => clearInterval(timer);
};
