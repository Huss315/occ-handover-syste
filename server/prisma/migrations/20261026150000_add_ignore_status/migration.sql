ALTER TYPE "TaskStatus" ADD VALUE 'Ignore';
ALTER TABLE "session_tasks" ADD COLUMN "ignore_reason" TEXT;