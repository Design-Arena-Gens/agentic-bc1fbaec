export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getAgentStatus } from "@/lib/agent";
import Dashboard from "@/components/Dashboard";

async function DashboardLoader() {
  const status = await getAgentStatus();
  return <Dashboard initialStatus={status} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading agent dashboard…</p>}>
      <DashboardLoader />
    </Suspense>
  );
}
