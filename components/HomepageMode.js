"use client";

import { createContext, useContext, useState } from "react";

const HomepageModeContext = createContext(null);

export function HomepageModeProvider({ children }) {
  const [mode, setMode] = useState("home");
  return <HomepageModeContext.Provider value={{ mode, setMode }}>{children}</HomepageModeContext.Provider>;
}

export function HomepageModeContent({ children }) {
  const { mode } = useContext(HomepageModeContext);
  return mode === "demo" ? null : children;
}

export function useHomepageMode() {
  const value = useContext(HomepageModeContext);
  if (!value) throw new Error("useHomepageMode must be used inside HomepageModeProvider");
  return value;
}
