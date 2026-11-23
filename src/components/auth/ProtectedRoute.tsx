"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="cm-spinner" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;

}
