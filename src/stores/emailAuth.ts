import { defineStore } from 'pinia';

interface EmailAuthState {
  jwt: string | undefined;
  email: string | undefined;
}

const STORAGE_KEY = 'tm-editor.emailAuth';

export const useEmailAuthStore = defineStore('emailAuth', {
  state: (): EmailAuthState => ({
    jwt: undefined,
    email: undefined,
  }),
  actions: {
    loadFromStorage() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as EmailAuthState;
        this.jwt = parsed.jwt;
        this.email = parsed.email;
      } catch {
        this.jwt = undefined;
        this.email = undefined;
      }
    },
    setJwt(jwt: string, email: string) {
      this.jwt = jwt;
      this.email = email || undefined;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ jwt: this.jwt, email: this.email })
      );
    },
    clear() {
      this.jwt = undefined;
      this.email = undefined;
      window.localStorage.removeItem(STORAGE_KEY);
    },
  },
});
