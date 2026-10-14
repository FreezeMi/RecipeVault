import { PrismaClient } from '@prisma/client';

// A single shared client keeps the number of database connections small.
export const prisma = new PrismaClient();
