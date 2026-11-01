import {
  IconBuildingWarehouse, IconChartBar, IconClipboardList, IconLayoutDashboard, IconReportMoney, IconSettings, IconTruck,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

export interface NavTab { id: string; label: string; description: string }
export interface NavModule {
  id: string; path: string; label: string; group: string; source?: string; access?: string; description: string;
  icon: ComponentType<{ className?: string }>; tabs?: NavTab[];
}

export const MODULES: NavModule[] = [
  { id: "home", path: "/", label: "Overview", group: "Workspace", icon: IconLayoutDashboard, description: "Today’s pulse across supply, sales and finance" },
  {
    id: "trips", path: "/trips", label: "Trip Analytics", group: "Primary supply", source: "Traqo TMS", access: "trip", icon: IconTruck,
    description: "Trip hygiene, costing, payments, detention & transporters",
    tabs: [
      { id: "live", label: "Live trips", description: "Every trip not yet ePOD-closed, by stage" },
      { id: "dispatch", label: "Dispatch tracker", description: "Date-wise dispatches by plant" },
      { id: "inside", label: "Vehicle ageing", description: "Inside plant, in transit and at destination" },
      { id: "hygiene", label: "Trip hygiene", description: "Order mix, tracking, fleet mix and completion" },
      { id: "costing", label: "Costing", description: "Freight, cost per km and L1 benchmark" },
      { id: "payments", label: "Payments", description: "ePOD → PI → payment funnel" },
      { id: "detention", label: "Detention", description: "Detention cost and claims vs system" },
      { id: "transporters", label: "Transporters", description: "Ranking and scorecard" },
      { id: "destinations", label: "Destinations", description: "Lanes, volume and cycle time" },
      { id: "accuracy", label: "Dispatch accuracy", description: "Shortage and excess at ePOD" },
      { id: "cash-discount", label: "Cash discount", description: "CD eligibility and capture" },
    ],
  },
  {
    id: "orders", path: "/orders", label: "Order Analytics", group: "Primary supply", source: "Traqo TMS", access: "order", icon: IconClipboardList,
    description: "Live order tracker, OTIF and planning performance",
    tabs: [
      { id: "live", label: "Live orders", description: "Open orders by stage and ageing" },
      { id: "destinations", label: "Destination tracker", description: "Pending orders by destination" },
      { id: "indents", label: "Indents & auctions", description: "Last 7 days of indents and auctions" },
      { id: "planning", label: "Planning", description: "Order-to-dispatch cycle time" },
      { id: "dedicated", label: "Dedicated fleet", description: "Daily utilisation of dedicated vehicles" },
      { id: "otif", label: "OTIF", description: "On-time in-full performance" },
      { id: "ecom", label: "E-com appointments", description: "Marketplace and Q-comm appointments" },
    ],
  },
  {
    id: "sales", path: "/sales", label: "Sales", group: "Sales", source: "DMS", access: "sales", icon: IconChartBar,
    description: "Team, brand and channel secondary sales vs target",
    tabs: [
      { id: "team", label: "Team", description: "Zone › Region › ASM" },
      { id: "brand", label: "Brand", description: "Brand › Pack" },
      { id: "channel", label: "Channel", description: "Channel › Sub-channel" },
      { id: "builder", label: "Build your own", description: "Pick a dimension, metric and chart" },
    ],
  },
  { id: "cfa", path: "/cfa", label: "CFA Throughput", group: "Secondary supply", access: "secondary", icon: IconBuildingWarehouse, description: "CFA-wise, date-wise dispatch quantity" },
  { id: "pnl", path: "/pnl", label: "E-com P&L", group: "Finance", access: "fin", icon: IconReportMoney, description: "Gross revenue to material margin by account" },
  {
    id: "settings", path: "/settings", label: "Settings", group: "Administration", icon: IconSettings, description: "Users, configuration and sync jobs",
    tabs: [
      { id: "users", label: "Users & access", description: "Who can see which dashboard" },
      { id: "config", label: "Configuration", description: "Refresh schedule and thresholds" },
      { id: "sync", label: "Sync jobs", description: "Source table sync history" },
      { id: "logic", label: "Metric definitions", description: "How every number is calculated" },
    ],
  },
];

export const moduleFor = (path: string) =>
  MODULES.filter((m) => m.path !== "/").find((m) => path === m.path || path.startsWith(m.path + "/")) ?? MODULES[0];
