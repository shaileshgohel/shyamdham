-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AccountHead" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "nameGu" TEXT NOT NULL,
    "nameEn" TEXT,
    "systemKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccountHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyAccount" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankDetails" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" SERIAL NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "headId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "toAccountId" INTEGER,
    "amount" DECIMAL(14,2) NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "party" TEXT,
    "narration" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "donationId" INTEGER,
    "bookingId" INTEGER,
    "attachment" BYTEA,
    "attachmentType" TEXT,
    "attachmentName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" SERIAL NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "donorName" TEXT NOT NULL,
    "familyId" INTEGER,
    "mobile" TEXT,
    "address" TEXT,
    "pan" TEXT,
    "headId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "mode" TEXT NOT NULL,
    "reference" TEXT,
    "accountId" INTEGER NOT NULL,
    "inMemoryOf" TEXT,
    "notes" TEXT,
    "verifyCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" SERIAL NOT NULL,
    "nameGu" TEXT NOT NULL,
    "nameEn" TEXT,
    "memberRate" DECIMAL(12,2) NOT NULL,
    "nonMemberRate" DECIMAL(12,2) NOT NULL,
    "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeItem" (
    "id" SERIAL NOT NULL,
    "nameGu" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'નંગ',
    "rate" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChargeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "bookingNo" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "hirerName" TEXT NOT NULL,
    "mobile" TEXT,
    "address" TEXT,
    "familyId" INTEGER,
    "isMember" BOOLEAN NOT NULL DEFAULT false,
    "eventType" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "slot" TEXT NOT NULL DEFAULT 'FULL',
    "guests" INTEGER,
    "notes" TEXT,
    "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingFacility" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "facilityId" INTEGER NOT NULL,

    CONSTRAINT "BookingFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingLine" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BookingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "nameGu" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'નંગ',
    "minQty" INTEGER NOT NULL DEFAULT 0,
    "chargeRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "bookingId" INTEGER,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountHead_systemKey_key" ON "AccountHead"("systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccountHead_type_nameGu_key" ON "AccountHead"("type", "nameGu");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_name_key" ON "MoneyAccount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_voucherNo_key" ON "Voucher"("voucherNo");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_donationId_key" ON "Voucher"("donationId");

-- CreateIndex
CREATE INDEX "Voucher_date_idx" ON "Voucher"("date");

-- CreateIndex
CREATE INDEX "Voucher_type_date_idx" ON "Voucher"("type", "date");

-- CreateIndex
CREATE INDEX "Voucher_headId_date_idx" ON "Voucher"("headId", "date");

-- CreateIndex
CREATE INDEX "Voucher_accountId_date_idx" ON "Voucher"("accountId", "date");

-- CreateIndex
CREATE INDEX "Voucher_bookingId_idx" ON "Voucher"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_receiptNo_key" ON "Donation"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_verifyCode_key" ON "Donation"("verifyCode");

-- CreateIndex
CREATE INDEX "Donation_date_idx" ON "Donation"("date");

-- CreateIndex
CREATE INDEX "Donation_familyId_idx" ON "Donation"("familyId");

-- CreateIndex
CREATE INDEX "Donation_status_date_idx" ON "Donation"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_nameGu_key" ON "Facility"("nameGu");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeItem_nameGu_key" ON "ChargeItem"("nameGu");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNo_key" ON "Booking"("bookingNo");

-- CreateIndex
CREATE INDEX "Booking_fromDate_toDate_idx" ON "Booking"("fromDate", "toDate");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "BookingFacility_facilityId_idx" ON "BookingFacility"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingFacility_bookingId_facilityId_key" ON "BookingFacility"("bookingId", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_nameGu_key" ON "Item"("nameGu");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");

-- CreateIndex
CREATE INDEX "StockMovement_bookingId_idx" ON "StockMovement"("bookingId");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_headId_fkey" FOREIGN KEY ("headId") REFERENCES "AccountHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_headId_fkey" FOREIGN KEY ("headId") REFERENCES "AccountHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingFacility" ADD CONSTRAINT "BookingFacility_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingFacility" ADD CONSTRAINT "BookingFacility_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLine" ADD CONSTRAINT "BookingLine_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------
-- Money records are a ledger: never deleted, and after saving only
-- the cancellation fields may change (ACTIVE -> CANCELLED, once).
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION ledger_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% rows cannot be deleted; cancel them instead', TG_TABLE_NAME;
  END IF;
  IF OLD."status" = 'CANCELLED' THEN
    RAISE EXCEPTION '% % is already cancelled', TG_TABLE_NAME, OLD."id";
  END IF;
  IF NEW."status" NOT IN ('ACTIVE', 'CANCELLED') THEN
    RAISE EXCEPTION 'invalid status %', NEW."status";
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status','cancelReason','cancelledAt','cancelledById'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','cancelReason','cancelledAt','cancelledById']) THEN
    RAISE EXCEPTION '% % cannot be edited; cancel it and enter a new one', TG_TABLE_NAME, OLD."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voucher_ledger_guard BEFORE UPDATE OR DELETE ON "Voucher"
  FOR EACH ROW EXECUTE FUNCTION ledger_guard();
CREATE TRIGGER donation_ledger_guard BEFORE UPDATE OR DELETE ON "Donation"
  FOR EACH ROW EXECUTE FUNCTION ledger_guard();
CREATE TRIGGER voucher_no_truncate BEFORE TRUNCATE ON "Voucher"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
CREATE TRIGGER donation_no_truncate BEFORE TRUNCATE ON "Donation"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();

-- Stock history is append-only too; corrections are new ADJUST movements.
CREATE TRIGGER stock_movement_append_only BEFORE UPDATE OR DELETE ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_type_valid" CHECK ("type" IN ('INCOME','EXPENSE','DEPOSIT_IN','DEPOSIT_OUT','CONTRA'));
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_contra_target" CHECK (("type" = 'CONTRA') = ("toAccountId" IS NOT NULL));
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_head_required" CHECK ("type" NOT IN ('INCOME','EXPENSE') OR "headId" IS NOT NULL);
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_qty_valid" CHECK ("qty" > 0 OR ("type" = 'ADJUST' AND "qty" <> 0));
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dates_valid" CHECK ("toDate" >= "fromDate");
