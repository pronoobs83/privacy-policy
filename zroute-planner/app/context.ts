import { createContext } from "react-router";

export type SessionUser = { id: string; name: string; email: string } | null;

export const sessionContext = createContext<SessionUser>(null);
