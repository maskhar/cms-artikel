"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SESSION_DURATION_MS, SESSION_TIMESTAMP_KEY } from "@/lib/session-policy";

// Lapis UX proaktif saja: penegakan sebenarnya ada di server (proxy.ts +
// requireUser()) yang memakai cookie httpOnly dengan konstanta yang sama.
const SESSION_DURATION = SESSION_DURATION_MS;
const SESSION_KEY = SESSION_TIMESTAMP_KEY;

export function SessionMonitor() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    async function performLogout() {
      localStorage.removeItem(SESSION_KEY);
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (error) {
        console.error("Auto logout error:", error);
      }
      router.push("/login?reason=session_expired");
      router.refresh();
    }

    function scheduleLogout(delay: number) {
      timeoutRef.current = setTimeout(() => {
        performLogout();
      }, delay);
    }

    // Cek apakah ada session yang sudah dimulai
    const sessionStart = localStorage.getItem(SESSION_KEY);
    const now = Date.now();

    if (!sessionStart) {
      // Buat session baru
      localStorage.setItem(SESSION_KEY, now.toString());
      scheduleLogout(SESSION_DURATION);
    } else {
      // Cek apakah session sudah expired
      const elapsed = now - parseInt(sessionStart, 10);
      if (elapsed >= SESSION_DURATION) {
        // Session expired, logout
        performLogout();
      } else {
        // Schedule logout untuk sisa waktu
        scheduleLogout(SESSION_DURATION - elapsed);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
