-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('COMPANY_ADMIN', 'SALES_AGENT', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'APPROVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('SADAD', 'MADA', 'BANK_TRANSFER', 'CASH', 'CHEQUE');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "crNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "area" INTEGER NOT NULL,
    "rooms" INTEGER NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reservationId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(14,2) NOT NULL,
    "downPayment" DECIMAL(14,2) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_crNumber_key" ON "companies"("crNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_id_companyId_key" ON "users"("id", "companyId");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "units_companyId_code_key" ON "units"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "units_id_companyId_key" ON "units"("id", "companyId");

-- CreateIndex
CREATE INDEX "units_companyId_status_idx" ON "units"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "clients_id_companyId_key" ON "clients"("id", "companyId");

-- CreateIndex
CREATE INDEX "clients_companyId_createdById_idx" ON "clients"("companyId", "createdById");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_id_companyId_key" ON "reservations"("id", "companyId");

-- CreateIndex
CREATE INDEX "reservations_companyId_unitId_status_idx" ON "reservations"("companyId", "unitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_companyId_contractNumber_key" ON "contracts"("companyId", "contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_id_companyId_key" ON "contracts"("id", "companyId");

-- CreateIndex
CREATE INDEX "contracts_companyId_status_idx" ON "contracts"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "installments_contractId_installmentNumber_key" ON "installments"("contractId", "installmentNumber");

-- CreateIndex
CREATE INDEX "installments_contractId_status_idx" ON "installments"("contractId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payments_companyId_receiptNumber_key" ON "payments"("companyId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_id_companyId_key" ON "payments"("id", "companyId");

-- CreateIndex
CREATE INDEX "payments_companyId_contractId_idx" ON "payments"("companyId", "contractId");

-- CreateIndex
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocations_installmentId_idx" ON "payment_allocations"("installmentId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_action_idx" ON "audit_logs"("companyId", "action");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "clients" ADD CONSTRAINT "clients_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "users"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "units"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_clientId_companyId_fkey" FOREIGN KEY ("clientId", "companyId") REFERENCES "clients"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "users"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_unitId_companyId_fkey" FOREIGN KEY ("unitId", "companyId") REFERENCES "units"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clientId_companyId_fkey" FOREIGN KEY ("clientId", "companyId") REFERENCES "clients"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "users"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_approvedById_companyId_fkey" FOREIGN KEY ("approvedById", "companyId") REFERENCES "users"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "payments" ADD CONSTRAINT "payments_contractId_companyId_fkey" FOREIGN KEY ("contractId", "companyId") REFERENCES "contracts"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite Multi-Tenant Foreign Key)
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_companyId_fkey" FOREIGN KEY ("createdById", "companyId") REFERENCES "users"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ==============================================================================
-- CUSTOM DATABASE INTEGRITY CONSTRAINTS (Mandated by Assessment)
-- ==============================================================================

-- 1. Unit positive price check
ALTER TABLE "units" ADD CONSTRAINT "check_unit_price_positive" CHECK ("price" > 0);

-- 2. Contract constraints
ALTER TABLE "contracts" ADD CONSTRAINT "check_contract_unit_price_positive" CHECK ("unitPrice" > 0);
ALTER TABLE "contracts" ADD CONSTRAINT "check_contract_discount_range" CHECK ("discountPercent" >= 0 AND "discountPercent" <= 5);
ALTER TABLE "contracts" ADD CONSTRAINT "check_contract_final_price_positive" CHECK ("finalPrice" > 0);
ALTER TABLE "contracts" ADD CONSTRAINT "check_contract_down_payment_valid" CHECK ("downPayment" >= 0 AND "downPayment" < "finalPrice");
ALTER TABLE "contracts" ADD CONSTRAINT "check_contract_installment_count_positive" CHECK ("installmentCount" > 0);

-- 3. Installment constraints
ALTER TABLE "installments" ADD CONSTRAINT "check_installment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "installments" ADD CONSTRAINT "check_installment_paid_amount_valid" CHECK ("paidAmount" >= 0 AND "paidAmount" <= "amount");

-- 4. Payment and Allocation positive amount checks
ALTER TABLE "payments" ADD CONSTRAINT "check_payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payment_allocations" ADD CONSTRAINT "check_payment_allocation_amount_positive" CHECK ("amount" > 0);

-- 5. Partial Unique Index: Only ONE active reservation per unit at a time (Mandated by Section 6)
CREATE UNIQUE INDEX "unique_active_unit_reservation" ON "reservations" ("unitId") WHERE "status" = 'ACTIVE';

-- 6. Trigger: Payment allocations cannot exceed corresponding payment amount (Mandated by Section 11)
CREATE OR REPLACE FUNCTION check_payment_allocation_ceiling()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_amount DECIMAL(14, 2);
  v_total_allocated DECIMAL(14, 2);
BEGIN
  SELECT "amount" INTO v_payment_amount FROM "payments" WHERE "id" = NEW."paymentId";
  SELECT COALESCE(SUM("amount"), 0) INTO v_total_allocated FROM "payment_allocations" WHERE "paymentId" = NEW."paymentId";
  
  IF v_total_allocated > v_payment_amount THEN
    RAISE EXCEPTION 'Total payment allocations (%) exceed payment amount (%)', v_total_allocated, v_payment_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_check_payment_allocation_ceiling
AFTER INSERT OR UPDATE ON "payment_allocations"
FOR EACH ROW EXECUTE FUNCTION check_payment_allocation_ceiling();

-- 7. Trigger: Installment allocations cannot exceed installment amount (Mandated by Section 11)
CREATE OR REPLACE FUNCTION check_installment_allocation_ceiling()
RETURNS TRIGGER AS $$
DECLARE
  v_installment_amount DECIMAL(14, 2);
  v_total_allocated DECIMAL(14, 2);
BEGIN
  SELECT "amount" INTO v_installment_amount FROM "installments" WHERE "id" = NEW."installmentId";
  SELECT COALESCE(SUM("amount"), 0) INTO v_total_allocated FROM "payment_allocations" WHERE "installmentId" = NEW."installmentId";
  
  IF v_total_allocated > v_installment_amount THEN
    RAISE EXCEPTION 'Total allocations (%) exceed installment amount (%)', v_total_allocated, v_installment_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_check_installment_allocation_ceiling
AFTER INSERT OR UPDATE ON "payment_allocations"
FOR EACH ROW EXECUTE FUNCTION check_installment_allocation_ceiling();
