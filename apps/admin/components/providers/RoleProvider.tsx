"use client";
import { createContext, useContext } from "react";
import type { AdminRole } from "../../lib/access";

const RoleContext = createContext<AdminRole>("owner");
export const RoleProvider = ({ role, children }: { role: AdminRole; children: React.ReactNode }) => <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
export const useRole = () => useContext(RoleContext);
