"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { UnitsView } from "@/components/views/UnitsView";
import { ClientsView } from "@/components/views/ClientsView";
import { ReservationsView } from "@/components/views/ReservationsView";
import { ContractsView } from "@/components/views/ContractsView";
import { InstallmentsView } from "@/components/views/InstallmentsView";
import { PaymentsView } from "@/components/views/PaymentsView";
import { AuditView } from "@/components/views/AuditView";

export type DashboardTab =
  | "units"
  | "clients"
  | "reservations"
  | "contracts"
  | "installments"
  | "payments"
  | "audit";

interface DashboardSPAProps {
  initialTab?: DashboardTab;
}

export function DashboardSPA({ initialTab = "units" }: DashboardSPAProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<DashboardTab>>(() => new Set([initialTab]));

  // Sync with browser URL on mount and browser back/forward buttons (popstate)
  useEffect(() => {
    const syncTabFromLocation = () => {
      const path = window.location.pathname;
      let targetTab: DashboardTab = "units";
      if (path.includes("clients")) targetTab = "clients";
      else if (path.includes("reservations")) targetTab = "reservations";
      else if (path.includes("contracts")) targetTab = "contracts";
      else if (path.includes("installments")) targetTab = "installments";
      else if (path.includes("payments")) targetTab = "payments";
      else if (path.includes("audit")) targetTab = "audit";
      else targetTab = "units";

      setActiveTab(targetTab);
      setVisitedTabs((prev) => {
        const next = new Set(prev);
        next.add(targetTab);
        return next;
      });
    };

    syncTabFromLocation();
    window.addEventListener("popstate", syncTabFromLocation);
    return () => window.removeEventListener("popstate", syncTabFromLocation);
  }, []);

  // Handle SPA tab switching with zero page reload
  const handleTabChange = (tabId: string, href: string) => {
    const validTab = tabId as DashboardTab;
    setActiveTab(validTab);
    setVisitedTabs((prev) => {
      const next = new Set(prev);
      next.add(validTab);
      return next;
    });
    if (typeof window !== "undefined") {
      window.history.pushState({ tab: validTab }, "", href);
    }
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange}>
      <div className="w-full flex-1 flex flex-col min-w-0">
        {visitedTabs.has("units") && (
          <div className={activeTab === "units" ? "block w-full" : "hidden"}>
            <UnitsView onNavigateTab={handleTabChange} />
          </div>
        )}
        {visitedTabs.has("clients") && (
          <div className={activeTab === "clients" ? "block w-full" : "hidden"}>
            <ClientsView onNavigateTab={handleTabChange} />
          </div>
        )}
        {visitedTabs.has("reservations") && (
          <div className={activeTab === "reservations" ? "block w-full" : "hidden"}>
            <ReservationsView onNavigateTab={handleTabChange} />
          </div>
        )}
        {visitedTabs.has("contracts") && (
          <div className={activeTab === "contracts" ? "block w-full" : "hidden"}>
            <ContractsView onNavigateTab={handleTabChange} />
          </div>
        )}
        {visitedTabs.has("installments") && (
          <div className={activeTab === "installments" ? "block w-full" : "hidden"}>
            <InstallmentsView onNavigateTab={handleTabChange} />
          </div>
        )}
        {visitedTabs.has("payments") && (
          <div className={activeTab === "payments" ? "block w-full" : "hidden"}>
            <PaymentsView onNavigateTab={handleTabChange} />
          </div>
        )}
        {visitedTabs.has("audit") && (
          <div className={activeTab === "audit" ? "block w-full" : "hidden"}>
            <AuditView onNavigateTab={handleTabChange} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
