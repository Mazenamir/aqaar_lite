import { PrismaClient, UserRole, UnitStatus, ContractStatus, InstallmentStatus, PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clean existing data
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

  const defaultPasswordHash = await bcrypt.hash("Password@123", 10);

  // 1. Company 1: شركة الرياض العقارية
  const company1 = await prisma.company.create({
    data: {
      name: "شركة الرياض العقارية",
      crNumber: "1010892341",
    },
  });

  const c1Admin = await prisma.user.create({
    data: {
      companyId: company1.id,
      email: "admin@riyadh.sa",
      name: "فهد العتيبي (مدير الشركة)",
      passwordHash: defaultPasswordHash,
      role: UserRole.COMPANY_ADMIN,
    },
  });

  const c1Accountant = await prisma.user.create({
    data: {
      companyId: company1.id,
      email: "acc@riyadh.sa",
      name: "محمد القحطاني (محاسب مالي)",
      passwordHash: defaultPasswordHash,
      role: UserRole.ACCOUNTANT,
    },
  });

  const c1Agent1 = await prisma.user.create({
    data: {
      companyId: company1.id,
      email: "agent1@riyadh.sa",
      name: "أحمد المنصور (مندوب مبيعات 1)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  const c1Agent2 = await prisma.user.create({
    data: {
      companyId: company1.id,
      email: "agent2@riyadh.sa",
      name: "سعود الحربي (مندوب مبيعات 2)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  // Units for Company 1
  const u1 = await prisma.unit.create({
    data: {
      companyId: company1.id,
      project: "مجمع النخيل ريزيدنس",
      code: "A-101",
      type: "شقة ديلوكس",
      floor: "الدور الأول",
      area: 185,
      rooms: 4,
      priceHalalas: BigInt(92000000), // 920,000 SAR
      status: UnitStatus.AVAILABLE,
    },
  });

  const u2 = await prisma.unit.create({
    data: {
      companyId: company1.id,
      project: "مجمع النخيل ريزيدنس",
      code: "B-204",
      type: "بنتهاوس فاخر",
      floor: "الدور الثاني",
      area: 240,
      rooms: 5,
      priceHalalas: BigInt(145000000), // 1,450,000 SAR
      status: UnitStatus.AVAILABLE,
    },
  });

  const u3 = await prisma.unit.create({
    data: {
      companyId: company1.id,
      project: "فلل ديار اليرموك",
      code: "V-01",
      type: "فيلا مستقلة",
      floor: "أرضي + أول",
      area: 380,
      rooms: 6,
      priceHalalas: BigInt(235000000), // 2,350,000 SAR
      status: UnitStatus.AVAILABLE,
    },
  });

  const u4 = await prisma.unit.create({
    data: {
      companyId: company1.id,
      project: "برج الأندلس السكني",
      code: "C-101",
      type: "استوديو تنفيذي",
      floor: "الدور الثالث",
      area: 95,
      rooms: 2,
      priceHalalas: BigInt(54000000), // 540,000 SAR
      status: UnitStatus.SOLD,
    },
  });

  // Clients for Agent 1
  const cl1 = await prisma.client.create({
    data: {
      companyId: company1.id,
      createdById: c1Agent1.id,
      name: "عبدالله بن فهد الشمري",
      phone: "0501234567",
      notes: "مهتم بشقق النخيل في الأدوار العليا، ميزانيته جاهزة للتمويل السريع.",
    },
  });

  const cl2 = await prisma.client.create({
    data: {
      companyId: company1.id,
      createdById: c1Agent1.id,
      name: "سارة بنت خالد القحطاني",
      phone: "0559876543",
      notes: "تبحث عن فيلا مستقلة في مجمع هادئ شمال الرياض.",
    },
  });

  // Client for Agent 2 (isolation verification)
  const cl3 = await prisma.client.create({
    data: {
      companyId: company1.id,
      createdById: c1Agent2.id,
      name: "فيصل بن محمد الدوسري",
      phone: "0543322110",
      notes: "مستثمر يرغب بشراء وحدات متعددة للإيجار.",
    },
  });

  // Contract for Unit 4 (Sold)
  const contract1 = await prisma.contract.create({
    data: {
      companyId: company1.id,
      contractNumber: "CNT-2026-0891",
      unitId: u4.id,
      clientId: cl1.id,
      createdById: c1Agent1.id,
      approvedById: c1Accountant.id,
      approvedAt: new Date("2026-01-15T10:00:00Z"),
      unitPriceHalalas: BigInt(54000000),
      discountPercent: 0,
      finalPriceHalalas: BigInt(54000000), // 540,000 SAR
      downPaymentHalalas: BigInt(18000000), // 180,000 SAR
      installmentCount: 4,
      status: ContractStatus.APPROVED,
      startDate: new Date("2026-01-15T00:00:00Z"),
    },
  });

  // 4 Installments (90,000 SAR = 9,000,000 halalas each)
  const inst1 = await prisma.installment.create({
    data: {
      contractId: contract1.id,
      installmentNumber: 1,
      dueDate: new Date("2026-02-15T00:00:00Z"),
      amountHalalas: BigInt(9000000),
      paidAmountHalalas: BigInt(9000000),
      status: InstallmentStatus.PAID,
      paidAt: new Date("2026-02-14T00:00:00Z"),
    },
  });

  const inst2 = await prisma.installment.create({
    data: {
      contractId: contract1.id,
      installmentNumber: 2,
      dueDate: new Date("2026-03-15T00:00:00Z"),
      amountHalalas: BigInt(9000000),
      paidAmountHalalas: BigInt(9000000),
      status: InstallmentStatus.PAID,
      paidAt: new Date("2026-03-15T00:00:00Z"),
    },
  });

  const inst3 = await prisma.installment.create({
    data: {
      contractId: contract1.id,
      installmentNumber: 3,
      dueDate: new Date("2026-04-15T00:00:00Z"),
      amountHalalas: BigInt(9000000),
      paidAmountHalalas: BigInt(0),
      status: InstallmentStatus.PENDING,
    },
  });

  const inst4 = await prisma.installment.create({
    data: {
      contractId: contract1.id,
      installmentNumber: 4,
      dueDate: new Date("2026-05-15T00:00:00Z"),
      amountHalalas: BigInt(9000000),
      paidAmountHalalas: BigInt(0),
      status: InstallmentStatus.PENDING,
    },
  });

  // Recorded Payments
  const p1 = await prisma.payment.create({
    data: {
      companyId: company1.id,
      contractId: contract1.id,
      createdById: c1Accountant.id,
      receiptNumber: "REC-2026-1001",
      amountHalalas: BigInt(9000000),
      method: PaymentMethod.SADAD,
      idempotencyKey: "seed-payment-key-001",
      notes: "سداد القسط الأول عبر نظام سداد الإلكتروني",
      createdAt: new Date("2026-02-14T10:00:00Z"),
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: p1.id,
      installmentId: inst1.id,
      amountHalalas: BigInt(9000000),
    },
  });

  const p2 = await prisma.payment.create({
    data: {
      companyId: company1.id,
      contractId: contract1.id,
      createdById: c1Accountant.id,
      receiptNumber: "REC-2026-1002",
      amountHalalas: BigInt(9000000),
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: "seed-payment-key-002",
      notes: "تحويل بنكي مباشر لحساب الشركة في الراجحي",
      createdAt: new Date("2026-03-15T12:00:00Z"),
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: p2.id,
      installmentId: inst2.id,
      amountHalalas: BigInt(9000000),
    },
  });

  // Audit Logs for Company 1
  await prisma.auditLog.create({
    data: {
      companyId: company1.id,
      userId: c1Accountant.id,
      action: "CONTRACT_APPROVED",
      entityType: "Contract",
      entityId: contract1.id,
      details: JSON.stringify({ contractNumber: contract1.contractNumber, unitCode: "C-101", finalPriceHalalas: "54000000" }),
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: company1.id,
      userId: c1Accountant.id,
      action: "PAYMENT_RECORDED",
      entityType: "Payment",
      entityId: p1.id,
      details: JSON.stringify({ receiptNumber: "REC-2026-1001", amountHalalas: "9000000" }),
    },
  });


  // 2. Company 2: شركة ديار نجد للتطوير (Tenant Isolation)
  const company2 = await prisma.company.create({
    data: {
      name: "شركة ديار نجد للتطوير",
      crNumber: "1010774422",
    },
  });

  const c2Admin = await prisma.user.create({
    data: {
      companyId: company2.id,
      email: "admin@najd.sa",
      name: "سليمان النجد (مدير ديار نجد)",
      passwordHash: defaultPasswordHash,
      role: UserRole.COMPANY_ADMIN,
    },
  });

  const c2Accountant = await prisma.user.create({
    data: {
      companyId: company2.id,
      email: "acc@najd.sa",
      name: "طارق الصالح (محاسب ديار نجد)",
      passwordHash: defaultPasswordHash,
      role: UserRole.ACCOUNTANT,
    },
  });

  const c2Agent1 = await prisma.user.create({
    data: {
      companyId: company2.id,
      email: "agent1@najd.sa",
      name: "ياسر الدريس (مندوب ديار نجد 1)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  const c2Agent2 = await prisma.user.create({
    data: {
      companyId: company2.id,
      email: "agent2@najd.sa",
      name: "خالد السالم (مندوب ديار نجد 2)",
      passwordHash: defaultPasswordHash,
      role: UserRole.SALES_AGENT,
    },
  });

  // Units for Company 2
  await prisma.unit.create({
    data: {
      companyId: company2.id,
      project: "أبراج نجد الفندقية",
      code: "N-201",
      type: "جناح تنفيذي",
      floor: "الدور الثامن",
      area: 120,
      rooms: 2,
      priceHalalas: BigInt(89000000), // 890,000 SAR
      status: UnitStatus.AVAILABLE,
    },
  });

  await prisma.unit.create({
    data: {
      companyId: company2.id,
      project: "مجمع ديار الغدير",
      code: "G-105",
      type: "تاون هاوس",
      floor: "أرضي + أول",
      area: 275,
      rooms: 5,
      priceHalalas: BigInt(165000000), // 1,650,000 SAR
      status: UnitStatus.AVAILABLE,
    },
  });

  // Client for Company 2
  await prisma.client.create({
    data: {
      companyId: company2.id,
      createdById: c2Agent1.id,
      name: "سلطان بن فهد الرويلي",
      phone: "0567891234",
      notes: "عميل خاص لشركة ديار نجد - مهتم بأبراج نجد.",
    },
  });

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
