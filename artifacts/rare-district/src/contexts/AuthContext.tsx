import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useGetMe, User } from '@workspace/api-client-react';

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isVendor: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  
  const { data: user, isLoading, refetch } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: ['/api/auth/me'],
      retry: false
    }
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    refetch();
  };

  const logout = () => {
    setToken(null);
  };

  const currentUser = user || null;

  return (
    <AuthContext.Provider value={{
      currentUser,
      token,
      login,
      logout,
      isAuthenticated: !!currentUser,
      isVendor: currentUser?.role === 'vendor',
      isAdmin: currentUser?.role === 'admin',
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
