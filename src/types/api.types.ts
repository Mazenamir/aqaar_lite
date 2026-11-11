import { UserRole, UnitStatus, ContractStatus, InstallmentStatus, PaymentMethod } from "@prisma/client";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthenticatedUserPayload {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  companyName: string;
}

export interface UnitDto {
  id: string;
  project: string;
  code: string;
  type: string;
  floor: string;
  area: number;
  rooms: number;
  priceHalalas: string;
  priceSar: string;
  status: UnitStatus;
  reservation?: {
    id: string;
    clientId: string;
    clientName: string;
    agentName: string;
    expiresAt: string;
  } | null;
}

export interface ClientDto {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdByName: string;
  activeReservationsCount: number;
  contractsCount: number;
  createdAt: string;
}

export interface InstallmentDto {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amountHalalas: string;
  amountSar: string;
  paidAmountHalalas: string;
  paidAmountSar: string;
  status: InstallmentStatus | "OVERDUE";
  paidAt: string | null;
}

export interface ContractDto {
  id: string;
  contractNumber: string;
  status: ContractStatus;
  unit: {
    id: string;
    code: string;
    project: string;
    type: string;
  };
  client: {
    id: string;
    name: string;
    phone: string;
  };
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  startDate: string;
  discountPercent: number;
  unitPriceHalalas: string;
  finalPriceHalalas: string;
  finalPriceSar: string;
  downPaymentHalalas: string;
  downPaymentSar: string;
  totalPaidHalalas: string;
  totalPaidSar: string;
  remainingBalanceHalalas: string;
  remainingBalanceSar: string;
  installments: InstallmentDto[];
}

export interface PaymentDto {
  id: string;
  receiptNumber: string;
  contractNumber: string;
  unitCode: string;
  clientName: string;
  amountHalalas: string;
  amountSar: string;
  method: PaymentMethod;
  notes: string;
  createdByName: string;
  createdAt: string;
  allocations: {
    installmentNumber: number;
    allocatedAmountSar: string;
  }[];
}

export interface AuditLogDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  ipAddress: string;
  userName: string;
  userRole: string;
  createdAt: string;
}
