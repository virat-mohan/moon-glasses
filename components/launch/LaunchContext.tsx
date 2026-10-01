"use client";

import { createContext, useContext, useEffect, useState } from "react";

const LaunchSoonContext = createContext(false);

/** localStorage flag set from Admin › Inventory Master: shows the buy buttons on the owner's own device for a test order. */
export const OWNER_PREVIEW_KEY = "moon-owner-order-preview";

export function LaunchSoonProvider({ soon, children }: { soon: boolean; children: React.ReactNode }) {
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    try {
      setPreview(localStorage.getItem(OWNER_PREVIEW_KEY) === "1");
    } catch {
      // storage blocked: stay in launching-soon mode
    }
  }, []);
  return <LaunchSoonContext.Provider value={soon && !preview}>{children}</LaunchSoonContext.Provider>;
}

export function useLaunchSoon() {
  return useContext(LaunchSoonContext);
}
