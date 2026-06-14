import { useSyncExternalStore } from "react";

import {
  getStreamStatus,
  subscribeStreamStatus,
} from "@/providers/sessions-cache";

export const useStreamStatus = () => {
  return useSyncExternalStore(subscribeStreamStatus, getStreamStatus, getStreamStatus);
};
