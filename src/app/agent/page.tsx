"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AgentDashboard } from "@/components/referrals/agent/AgentDashboard";

export default function AgentPage() {
  return (
    <ProtectedRoute>
      <AgentDashboard />
    </ProtectedRoute>
  );
}
