import { create } from "zustand";

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  mfaEnabled: boolean;
  profilePhoto?: string | null;
  enabledModules?: string[];
  businessName?: string;
  licenseExpiresAt?: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  originalToken: string | null;
  originalUser: UserProfile | null;
  setAuth: (token: string, user: UserProfile) => void;
  setImpersonate: (token: string, user: UserProfile, origToken: string, origUser: UserProfile) => void;
  stopImpersonate: () => void;
  updateUser: (user: Partial<UserProfile>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("accessToken"),
  user: localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!) : null,
  originalToken: localStorage.getItem("originalToken"),
  originalUser: localStorage.getItem("originalUser") ? JSON.parse(localStorage.getItem("originalUser")!) : null,
  setAuth: (token, user) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ accessToken: token, user });
  },
  setImpersonate: (token, user, origToken, origUser) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("originalToken", origToken);
    localStorage.setItem("originalUser", JSON.stringify(origUser));
    set({ accessToken: token, user, originalToken: origToken, originalUser: origUser });
  },
  stopImpersonate: () => {
    const origToken = localStorage.getItem("originalToken");
    const origUser = localStorage.getItem("originalUser");
    localStorage.removeItem("originalToken");
    localStorage.removeItem("originalUser");
    if (origToken && origUser) {
      localStorage.setItem("accessToken", origToken);
      localStorage.setItem("user", origUser);
      set({
        accessToken: origToken,
        user: JSON.parse(origUser),
        originalToken: null,
        originalUser: null
      });
    }
  },
  updateUser: (updatedFields) => {
    set((state) => {
      if (!state.user) return state;
      const newUser = { ...state.user, ...updatedFields };
      localStorage.setItem("user", JSON.stringify(newUser));
      return { user: newUser };
    });
  },
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("originalToken");
    localStorage.removeItem("originalUser");
    set({ accessToken: null, user: null, originalToken: null, originalUser: null });
  },
}));
