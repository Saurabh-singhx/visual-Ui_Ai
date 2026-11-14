export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const createAuthStore = () => ({
  token: null,
  isAuthenticated: false,
  login(token: string) {
    this.token = token;
    this.isAuthenticated = true;
  },
  logout() {
    this.token = null;
    this.isAuthenticated = false;
  },
});
