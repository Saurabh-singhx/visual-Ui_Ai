export class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async fetchUsers(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/users`);
    return res.json();
  }
}
