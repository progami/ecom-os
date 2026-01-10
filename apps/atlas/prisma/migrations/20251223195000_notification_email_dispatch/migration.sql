-- Add DB-backed email dispatch queue for notifications.

CREATE TYPE "NotificationEmailDispatchStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

CREATE TABLE "NotificationEmailDispatch" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "NotificationEmailDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEmailDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationEmailDispatch_notificationId_employeeId_key"
ON "NotificationEmailDispatch"("notificationId", "employeeId");

CREATE INDEX "NotificationEmailDispatch_status_nextAttemptAt_idx"
ON "NotificationEmailDispatch"("status", "nextAttemptAt");

CREATE INDEX "NotificationEmailDispatch_employeeId_idx" ON "NotificationEmailDispatch"("employeeId");

CREATE INDEX "NotificationEmailDispatch_notificationId_idx" ON "NotificationEmailDispatch"("notificationId");

ALTER TABLE "NotificationEmailDispatch"
ADD CONSTRAINT "NotificationEmailDispatch_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationEmailDispatch"
ADD CONSTRAINT "NotificationEmailDispatch_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
