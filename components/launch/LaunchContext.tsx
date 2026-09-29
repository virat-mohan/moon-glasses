"use client";

import { createContext, useContext } from "react";

const LaunchSoonContext = createContext(false);

export function LaunchSoonProvider({ soon, children }: { soon: boolean; children: React.ReactNode }) {
  return <LaunchSoonContext.Provider value={soon}>{children}</LaunchSoonContext.Provider>;
}

export function useLaunchSoon() {
  return useContext(LaunchSoonContext);
}
