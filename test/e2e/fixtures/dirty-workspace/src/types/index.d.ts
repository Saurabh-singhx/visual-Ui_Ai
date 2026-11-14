export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export type ThemeMode = 'light' | 'dark' | 'system';
