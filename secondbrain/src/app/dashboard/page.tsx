import type { Metadata } from "next";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
export const metadata: Metadata = {
  title: "Administración | LumaDiary",
  robots: { index: false, follow: false },
};
export default function DashboardPage() {
  return <AdminDashboard />;
}
