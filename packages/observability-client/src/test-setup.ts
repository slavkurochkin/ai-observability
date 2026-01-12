import '@testing-library/jest-dom';

// Create proper storage mocks
class StorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

// Mock localStorage and sessionStorage
global.localStorage = new StorageMock() as any;
global.sessionStorage = new StorageMock() as any;

// Mock fetch
global.fetch = jest.fn();

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  (global.localStorage as any).clear();
  (global.sessionStorage as any).clear();
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
});
