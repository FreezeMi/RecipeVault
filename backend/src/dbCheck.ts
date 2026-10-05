import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const CHECK_INTERVAL = 5 * 24 * 60 * 60 * 1000; // 5 days
const FILE_PATH = path.join(process.cwd(), '.dbcheck.json');

export interface CheckStatus {
  isOkay: boolean;
  lastCheck: string | null;
}

let currentStatus: CheckStatus = {
  isOkay: false,
  lastCheck: null
};

// Load initial status
if (fs.existsSync(FILE_PATH)) {
  try {
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    currentStatus = JSON.parse(data);
  } catch (e) {
    console.error('Failed to read .dbcheck.json', e);
  }
}

export const getDbStatus = (): CheckStatus => currentStatus;

export const initDbCheck = (prisma: PrismaClient) => {
  const performCheck = async () => {
    try {
      // Execute a simple query to keep DB alive and check status
      await prisma.$queryRaw`SELECT 1`;
      currentStatus = {
        isOkay: true,
        lastCheck: new Date().toISOString()
      };
      console.log('Database check successful');
    } catch (error) {
      console.error('Database check failed:', error);
      currentStatus = {
        isOkay: false,
        lastCheck: new Date().toISOString()
      };
    }
    
    // Save to file
    try {
      fs.writeFileSync(FILE_PATH, JSON.stringify(currentStatus));
    } catch (e) {
      console.error('Failed to write .dbcheck.json', e);
    }
  };

  const checkAndRun = () => {
    const now = Date.now();
    const lastCheckTime = currentStatus.lastCheck ? new Date(currentStatus.lastCheck).getTime() : 0;
    
    if (now - lastCheckTime >= CHECK_INTERVAL) {
      performCheck();
    }
  };

  // Run on startup
  checkAndRun();

  // Then check every hour to see if 5 days have passed since last check
  setInterval(checkAndRun, 60 * 60 * 1000);
};
