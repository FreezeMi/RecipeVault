import { PrismaClient } from '@prisma/client';

// A single shared client keeps the connection pool small (important on Supabase's pooler).
export const prisma = new PrismaClient();
