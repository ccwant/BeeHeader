export class StorageService {
  private storage: chrome.storage.StorageArea | null;

  constructor() {
    this.storage =
      typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.storage) {
      return new Promise((resolve, reject) => {
        this.storage!.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }
    localStorage.setItem(key, JSON.stringify(value));
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.storage) {
      return new Promise((resolve, reject) => {
        this.storage!.get([key], (result: Record<string, unknown>) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve((result[key] as T) ?? null);
          }
        });
      });
    }
    const data = localStorage.getItem(key);
    return data ? (JSON.parse(data) as T) : null;
  }
}
