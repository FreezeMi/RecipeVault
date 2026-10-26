-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "translations" TEXT;
