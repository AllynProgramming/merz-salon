import { useCallback, useEffect, useState } from "react";
import AuthContext from "./auth-context.js";

const TOKEN_KEY = "merz.auth.token";

async function authRequest(path, { token, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      window.dispatchEvent(new Event("merz:session-expired"));
    }
    const error = new Error(
      payload.message || "Something went wrong. Please try again.",
    );
    error.status = response.status;
    error.errors = payload.errors;
    throw error;
  }

  return payload;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    const expireSession = () => {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem("merz.booking.mock-appointments");
      setToken(null);
      setUser(null);
      setIsRestoring(false);
      setAuthNotice("Your session expired. Please log in again.");
    };
    const handleStorage = (event) => {
      if (event.key !== TOKEN_KEY) return;
      if (!event.newValue) {
        sessionStorage.removeItem("merz.booking.mock-appointments");
      }
      setToken(event.newValue);
      setUser(null);
      setIsRestoring(Boolean(event.newValue));
      setAuthNotice(
        event.newValue
          ? "Your account session changed in another tab."
          : "You were logged out in another tab.",
      );
    };

    window.addEventListener("merz:session-expired", expireSession);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("merz:session-expired", expireSession);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!token) {
        setIsRestoring(false);
        return;
      }

      try {
        const response = await authRequest("/api/users/me", { token });
        if (active) setUser(response.user);
      } catch (error) {
        if (error.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          if (active) {
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        if (active) setIsRestoring(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, [token]);

  const saveSession = (response) => {
    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
    setAuthNotice("");
  };

  const register = async (details) => {
    const response = await authRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(details),
    });
    saveSession(response);
    return response.user;
  };

  const login = async (credentials) => {
    const response = await authRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    saveSession(response);
    return response.user;
  };

  const loginWithToken = useCallback(async (authToken) => {
    localStorage.setItem(TOKEN_KEY, authToken);
    setToken(authToken);
    const response = await authRequest("/api/users/me", { token: authToken });
    setUser(response.user);
    setAuthNotice("");
    return response.user;
  }, []);

  const logout = async () => {
    const activeToken = token;
    try {
      if (activeToken) {
        await authRequest("/api/auth/logout", {
          method: "POST",
          token: activeToken,
        });
      }
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem("merz.booking.mock-appointments");
      setToken(null);
      setUser(null);
    }
  };

  const updateProfile = async (profile) => {
    const response = await authRequest("/api/users/me", {
      method: "PUT",
      token,
      body: JSON.stringify(profile),
    });
    setUser(response.user);
    return response;
  };

  const changePassword = async (passwords) => {
    const response = await authRequest("/api/users/me/password", {
      method: "PUT",
      token,
      body: JSON.stringify(passwords),
    });
    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
    return response;
  };

  const getDashboard = async () => authRequest("/api/dashboard", { token });

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isRestoring,
        register,
        login,
        loginWithToken,
        logout,
        authNotice,
        updateProfile,
        changePassword,
        getDashboard,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
