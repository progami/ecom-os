-- Add per-employee read receipts for broadcast notifications.

CREATE TABLE "NotificationReadReceipt" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationReadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationReadReceipt_notificationId_employeeId_key"
ON "NotificationReadReceipt"("notificationId", "employeeId");

CREATE INDEX "NotificationReadReceipt_employeeId_idx" ON "NotificationReadReceipt"("employeeId");

CREATE INDEX "NotificationReadReceipt_notificationId_idx" ON "NotificationReadReceipt"("notificationId");

ALTER TABLE "NotificationReadReceipt"
ADD CONSTRAINT "NotificationReadReceipt_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationReadReceipt"
ADD CONSTRAINT "NotificationReadReceipt_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

