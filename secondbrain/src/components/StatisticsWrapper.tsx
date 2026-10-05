"use client";

import dynamic from "next/dynamic";
import Loading from "@/components/Loading";

interface StatisticsWrapperProps {
  userId: string;
  onOpenEntry?: (date: string) => void;
  onOpenPerson?: (name: string) => void;
}

// Importar Statistics dinámicamente sin SSR
const Statistics = dynamic(() => import("@/components/Statistics"), {
  ssr: false,
  loading: () => (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    </div>
  ),
});

export default function StatisticsWrapper(props: StatisticsWrapperProps) {
  return <Statistics {...props} />;
}
