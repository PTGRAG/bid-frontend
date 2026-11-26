"use client";

import { AgentDashboard } from "@/components/referrals/agent/AgentDashboard";

// Not behind ProtectedRoute: visitors who aren't signed in see the agent pitch with sign-up and
// sign-in buttons.
export default function AgentPage() {
  return <AgentDashboard />;
}
