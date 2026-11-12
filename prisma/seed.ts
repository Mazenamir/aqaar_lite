import {
  PrismaClient,
  Prisma,
  UserRole,
  UnitStatus,
  ReservationStatus,
  ContractStatus,
  InstallmentStatus,
  PaymentMethod,
} from "@prisma/client";
import { addDays, addHours, addMonths, endOfMonth, setDate, getDate } from "date-fns";
import { hashPassword } from "../src/lib/security/password";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed with Argon2id & Composite Multi-Tenancy...");

  // Clean existing data in reverse foreign key order
  await prisma.auditLog.deleteMany({});
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.installment.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});

  const defaultPasswordHash = await hashPassword("Password123!");

  // =========================================================================
  // 1. COMPANY A: شركة الريادة الخضراء للتطوير العقاري (Primary Tenant)
  // =========================================================================
  const companyA = await prisma.company.create({
    data: {
      name: "شركة الريادة الخضراء للتطوير العقاري",
      crNumber: "1010892341",
    },
  });

  const adminA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      email: "admin@greenryad.sa",
      name: "م. عبدالله التميمي (مدير الشركة)",
      passwordHash: defaultPasswordHash,
      role: UserRole.COMPANY_ADMIN,
    },
  });

  const accountantA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      email: "accountant@greenryad.sa",
      name: "أ. طارق العسيري (محاسب مالي)",
      passwordHash: defaultPasswordHash,
      role: UserRole.ACCOUNTANT,
    },
  });

  const agentA1 = await prisma.user.create({
    data: {
      companyId: companyA.id,
      email: "agent1@greenryad.sa",
      name: "أحمد المنصور (مندوب مبيعات 1)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  const agentA2 = await prisma.user.create({
    data: {
      companyId: companyA.id,
      email: "agent2@greenryad.sa",
      name: "سارة الدوسري (مندوب مبيعات 2)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  // Additional compatibility accounts for Company A (supporting both greenryad.sa and riyadh.sa)
  await prisma.user.create({
    data: {
      companyId: companyA.id,
      email: "admin@riyadh.sa",
      name: "م. فهد العتيبي (مدير شركة الرياض)",
      passwordHash: defaultPasswordHash,
      role: UserRole.COMPANY_ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      companyId: companyA.id,
      email: "acc@riyadh.sa",
      name: "محمد القحطاني (محاسب مالي)",
      passwordHash: defaultPasswordHash,
      role: UserRole.ACCOUNTANT,
    },
  });

  await prisma.user.create({
    data: {
      companyId: companyA.id,
      email: "agent1@riyadh.sa",
      name: "أحمد المنصور (مبيعات 1)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  await prisma.user.create({
    data: {
      companyId: companyA.id,
      email: "agent2@riyadh.sa",
      name: "سعود الحربي (مبيعات 2)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  // Units for Company A
  const unitA1 = await prisma.unit.create({
    data: {
      companyId: companyA.id,
      project: "مجمع النخيل ريزيدنس",
      code: "A-101",
      type: "شقة ديلوكس",
      floor: "الدور الأول",
      area: 185,
      rooms: 4,
      price: new Prisma.Decimal("920000.00"),
      status: UnitStatus.AVAILABLE,
    },
  });

  const unitA2 = await prisma.unit.create({
    data: {
      companyId: companyA.id,
      project: "مجمع النخيل ريزيدنس",
      code: "B-204",
      type: "بنتهاوس فاخر",
      floor: "الدور الثاني",
      area: 240,
      rooms: 5,
      price: new Prisma.Decimal("1450000.00"),
      status: UnitStatus.RESERVED,
    },
  });

  const unitA3 = await prisma.unit.create({
    data: {
      companyId: companyA.id,
      project: "أبراج العليا ريزيدنس",
      code: "C-305",
      type: "شقة استوديو فاخر",
      floor: "الدور الثالث",
      area: 95,
      rooms: 2,
      price: new Prisma.Decimal("580000.00"),
      status: UnitStatus.SOLD,
    },
  });

  await prisma.unit.create({
    data: {
      companyId: companyA.id,
      project: "أبراج العليا ريزيدنس",
      code: "D-401",
      type: "فيلا روف",
      floor: "الدور الرابع",
      area: 320,
      rooms: 6,
      price: new Prisma.Decimal("2100000.00"),
      status: UnitStatus.AVAILABLE,
    },
  });

  // Clients for Company A
  const clientA1 = await prisma.client.create({
    data: {
      companyId: companyA.id,
      createdById: agentA1.id,
      name: "خالد بن عبدالعزيز الشمري",
      phone: "0501234567",
      notes: "مهتم بوحدات النخيل ريزيدنس - دفع كاش أو أقساط ميسرة",
    },
  });

  const clientA2 = await prisma.client.create({
    data: {
      companyId: companyA.id,
      createdById: agentA1.id,
      name: "سلطان إبراهيم الراجحي",
      phone: "0559876543",
      notes: "عميل VIP يبحث عن بنتهاوس للمعيشة العائلية",
    },
  });

  await prisma.client.create({
    data: {
      companyId: companyA.id,
      createdById: agentA2.id,
      name: "منى سعد الغامدي",
      phone: "0543219876",
      notes: "مستثمرة عقارية تبحث عن شقق قابلة لإعادة التأجير",
    },
  });

  // Active Reservation for Unit A2 (72 hours expiration)
  await prisma.reservation.create({
    data: {
      companyId: companyA.id,
      unitId: unitA2.id,
      clientId: clientA2.id,
      createdById: agentA1.id,
      expiresAt: addHours(new Date(), 72),
      status: ReservationStatus.ACTIVE,
    },
  });

  // Approved Contract for Unit A3 (SOLD)
  const contractA1 = await prisma.contract.create({
    data: {
      companyId: companyA.id,
      contractNumber: "CNT-2026-1001",
      unitId: unitA3.id,
      clientId: clientA1.id,
      createdById: agentA1.id,
      approvedById: accountantA.id,
      approvedAt: addDays(new Date(), -30),
      unitPrice: new Prisma.Decimal("580000.00"),
      discountPercent: new Prisma.Decimal("3.00"),
      finalPrice: new Prisma.Decimal("562600.00"), // 580,000 - 3% (17,400) = 562,600
      downPayment: new Prisma.Decimal("100000.00"),
      installmentCount: 12,
      status: ContractStatus.APPROVED,
      startDate: new Date("2026-01-15T00:00:00Z"),
    },
  });

  // Generate Installments for Contract A1 (Remaining: 462,600 across 12 months)
  // 462,600 / 12 = exactly 38,550.00 per month
  const installmentBase = new Prisma.Decimal("38550.00");
  const contractA1Installments = [];
  const startDay = getDate(contractA1.startDate);

  for (let i = 1; i <= 12; i++) {
    const targetMonth = addMonths(contractA1.startDate, i);
    const maxDays = getDate(endOfMonth(targetMonth));
    const targetDay = Math.min(startDay, maxDays);
    const dueDate = setDate(targetMonth, targetDay);

    const isPaid = i <= 2;
    const isPartial = i === 3;

    let paidAmount = new Prisma.Decimal("0.00");
    let status: InstallmentStatus = InstallmentStatus.PENDING;
    let paidAt: Date | null = null;

    if (isPaid) {
      paidAmount = installmentBase;
      status = InstallmentStatus.PAID;
      paidAt = addDays(dueDate, -2);
    } else if (isPartial) {
      paidAmount = new Prisma.Decimal("18550.00");
      status = InstallmentStatus.PARTIAL;
      paidAt = addDays(dueDate, -1);
    }

    const inst = await prisma.installment.create({
      data: {
        contractId: contractA1.id,
        installmentNumber: i,
        dueDate,
        amount: installmentBase,
        paidAmount,
        status,
        paidAt,
      },
    });
    contractA1Installments.push(inst);
  }

  // Payment 1 for Contract A1: Covers Installment 1 & 2 fully (77,100.00)
  const paymentA1 = await prisma.payment.create({
    data: {
      companyId: companyA.id,
      contractId: contractA1.id,
      createdById: accountantA.id,
      receiptNumber: "REC-2026-0001",
      amount: new Prisma.Decimal("77100.00"),
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: "idemp-seed-ryad-pay-001",
      notes: "سداد أول قسطين بموجب حوالة مصرفية رقم TR-88912",
      createdAt: addDays(new Date(), -25),
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: paymentA1.id,
      installmentId: contractA1Installments[0]!.id,
      amount: new Prisma.Decimal("38550.00"),
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: paymentA1.id,
      installmentId: contractA1Installments[1]!.id,
      amount: new Prisma.Decimal("38550.00"),
    },
  });

  // Payment 2 for Contract A1: Partial payment for Installment 3 (18,550.00)
  const paymentA2 = await prisma.payment.create({
    data: {
      companyId: companyA.id,
      contractId: contractA1.id,
      createdById: accountantA.id,
      receiptNumber: "REC-2026-0002",
      amount: new Prisma.Decimal("18550.00"),
      method: PaymentMethod.MADA,
      idempotencyKey: "idemp-seed-ryad-pay-002",
      notes: "سداد جزئي للقسط الثالث عبر بطاقة مدى",
      createdAt: addDays(new Date(), -5),
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: paymentA2.id,
      installmentId: contractA1Installments[2]!.id,
      amount: new Prisma.Decimal("18550.00"),
    },
  });

  // Audit Logs for Company A
  await prisma.auditLog.create({
    data: {
      companyId: companyA.id,
      userId: adminA.id,
      action: "UNIT_CREATED",
      entityType: "Unit",
      entityId: unitA1.id,
      details: JSON.stringify({ code: "A-101", price: "920000.00" }),
      ipAddress: "127.0.0.1",
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: companyA.id,
      userId: accountantA.id,
      action: "CONTRACT_APPROVED",
      entityType: "Contract",
      entityId: contractA1.id,
      details: JSON.stringify({ contractNumber: contractA1.contractNumber, unitId: unitA3.id }),
      ipAddress: "127.0.0.1",
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: companyA.id,
      userId: accountantA.id,
      action: "PAYMENT_RECORDED",
      entityType: "Payment",
      entityId: paymentA1.id,
      details: JSON.stringify({ receiptNumber: paymentA1.receiptNumber, amount: "77100.00" }),
      ipAddress: "127.0.0.1",
    },
  });


  // =========================================================================
  // 2. COMPANY B: شركة الأفق للاستثمار العقاري (Isolated Multi-Tenant Company)
  // =========================================================================
  const companyB = await prisma.company.create({
    data: {
      name: "شركة الأفق للاستثمار العقاري",
      crNumber: "2050119842",
    },
  });

  const adminB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: "admin@horizon.sa",
      name: "م. خالد القحطاني (مدير شركة الأفق)",
      passwordHash: defaultPasswordHash,
      role: UserRole.COMPANY_ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: "accountant@horizon.sa",
      name: "أ. سعد العتيبي (محاسب شركة الأفق)",
      passwordHash: defaultPasswordHash,
      role: UserRole.ACCOUNTANT,
    },
  });

  const agentB1 = await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: "agent1@horizon.sa",
      name: "ريم الشمري (مندوبة مبيعات الأفق)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: "agent2@horizon.sa",
      name: "فيصل الدوسري (مندوب مبيعات الأفق)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  // Additional compatibility account for Company B (supporting najd.sa isolation testing)
  await prisma.user.create({
    data: {
      companyId: companyB.id,
      email: "admin@najd.sa",
      name: "سليمان النجد (مدير ديار نجد)",
      passwordHash: defaultPasswordHash,
      role: UserRole.COMPANY_ADMIN,
    },
  });

  // Units for Company B
  // Notice: Same code "A-101" to rigorously verify unique constraint is scoped to companyId!
  const unitB1 = await prisma.unit.create({
    data: {
      companyId: companyB.id,
      project: "برج الأفق الذهبي",
      code: "A-101",
      type: "شقة إطلالة بحرية",
      floor: "الدور الخامس",
      area: 160,
      rooms: 3,
      price: new Prisma.Decimal("1100000.00"),
      status: UnitStatus.AVAILABLE,
    },
  });

  await prisma.unit.create({
    data: {
      companyId: companyB.id,
      project: "برج الأفق الذهبي",
      code: "HZ-201",
      type: "سكاي فيلا",
      floor: "الدور العاشر",
      area: 280,
      rooms: 5,
      price: new Prisma.Decimal("1850000.00"),
      status: UnitStatus.AVAILABLE,
    },
  });

  // Clients for Company B
  await prisma.client.create({
    data: {
      companyId: companyB.id,
      createdById: agentB1.id,
      name: "طارق بن ناصر البوعينين",
      phone: "0561122334",
      notes: "عميل شركة الأفق - مهتم بشقق برج الأفق الذهبي",
    },
  });

  // Audit Log for Company B
  await prisma.auditLog.create({
    data: {
      companyId: companyB.id,
      userId: adminB.id,
      action: "UNIT_CREATED",
      entityType: "Unit",
      entityId: unitB1.id,
      details: JSON.stringify({ code: "A-101", price: "1100000.00", company: "الأفق" }),
      ipAddress: "127.0.0.1",
    },
  });

  console.log("✅ Seed completed successfully!");
  console.log("-----------------------------------------------------------------");
  console.log("🏢 Company 1: شركة الريادة الخضراء للتطوير العقاري");
  console.log("   Admin:       admin@greenryad.sa      (Password: Password123!)");
  console.log("   Accountant:  accountant@greenryad.sa (Password: Password123!)");
  console.log("   Sales Rep 1: agent1@greenryad.sa     (Password: Password123!)");
  console.log("   Sales Rep 2: agent2@greenryad.sa     (Password: Password123!)");
  console.log("-----------------------------------------------------------------");
  console.log("🏢 Company 2: شركة الأفق للاستثمار العقاري (Tenant Isolation Demo)");
  console.log("   Admin:       admin@horizon.sa        (Password: Password123!)");
  console.log("   Accountant:  accountant@horizon.sa   (Password: Password123!)");
  console.log("   Sales Rep 1: agent1@horizon.sa       (Password: Password123!)");
  console.log("   Sales Rep 2: agent2@horizon.sa       (Password: Password123!)");
  console.log("-----------------------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
