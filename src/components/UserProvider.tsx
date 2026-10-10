"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type Ctx = { me: Profile | null; refresh: () => Promise<void> };

const UserCtx = createContext<Ctx>({ me: null, refresh: async () => {} });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);

  async function refresh() {
    const sb = supabase();
    const { data } = await sb.auth.getUser();
    if (!data.user) return setMe(null);
    const { data: profile } = await sb
      .from("profiles")
      .select("id, display_name")
      .eq("id", data.user.id)
      .single();
    setMe(profile ?? { id: data.user.id, display_name: "" });
  }

  useEffect(() => {
    refresh();
  }, []);

  return <UserCtx.Provider value={{ me, refresh }}>{children}</UserCtx.Provider>;
}

export const useMe = () => useContext(UserCtx);
