"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { UnitsView } from "@/components/views/UnitsView";
import { ClientsView } from "@/components/views/ClientsView";
import { ContractsView } from "@/components/views/ContractsView";
import { PaymentsView } from "@/components/views/PaymentsView";
import { AuditView } from "@/components/views/AuditView";

export type DashboardTab = "units" | "clients" | "contracts" | "payments" | "audit";

interface DashboardSPAProps {
  initialTab?: DashboardTab;
}

export function DashboardSPA({ initialTab = "units" }: DashboardSPAProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  // Sync with browser URL on mount and browser back/forward buttons (popstate)
  useEffect(() => {
    const syncTabFromLocation = () => {
      const path = window.location.pathname;
      if (path.includes("clients")) setActiveTab("clients");
      else if (path.includes("contracts")) setActiveTab("contracts");
      else if (path.includes("payments")) setActiveTab("payments");
      else if (path.includes("audit")) setActiveTab("audit");
      else setActiveTab("units");
    };

    syncTabFromLocation();
    window.addEventListener("popstate", syncTabFromLocation);
    return () => window.removeEventListener("popstate", syncTabFromLocation);
  }, []);

  // Handle SPA tab switching with zero page reload
  const handleTabChange = (tabId: string, href: string) => {
    const validTab = tabId as DashboardTab;
    setActiveTab(validTab);
    if (typeof window !== "undefined") {
      window.history.pushState({ tab: validTab }, "", href);
    }
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange}>
      {activeTab === "units" && <UnitsView onNavigateTab={handleTabChange} />}
      {activeTab === "clients" && <ClientsView onNavigateTab={handleTabChange} />}
      {activeTab === "contracts" && <ContractsView onNavigateTab={handleTabChange} />}
      {activeTab === "payments" && <PaymentsView onNavigateTab={handleTabChange} />}
      {activeTab === "audit" && <AuditView onNavigateTab={handleTabChange} />}
    </AppShell>
  );
}
