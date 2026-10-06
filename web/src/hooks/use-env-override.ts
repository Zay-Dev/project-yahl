import type { TResponseEnvOverrideStatus } from "@project-yahl/server/modules/platform/-api-types";

import { useEffect, useState } from "react";

import { getEnvOverrideStatus } from "@/pages/platform/lib/platform-api";

const POLL_MS = 2000;

export const useEnvOverrideStatus = () => {
  const [status, setStatus] = useState<TResponseEnvOverrideStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const load = async () => {
      if (inFlight) {
        return;
      }

      inFlight = true;

      try {
        const next = await getEnvOverrideStatus();

        if (!cancelled) {
          setStatus(next);
        }
      } catch {
        if (!cancelled) {
          setStatus(null);
        }
      } finally {
        inFlight = false;
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return { status };
};
