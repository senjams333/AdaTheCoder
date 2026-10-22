import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User } from './types';

export interface AuthState {
  token: string | null;
  user: User | null;
  /** false until the saved log-in has been read from this browser */
  ready: boolean;
  /** true right after "Log out", until the next page: pages then don't send you to a log-in page */
  leaving: boolean;
}

const initialState: AuthState = { token: null, user: null, ready: false, leaving: false };
export const AUTH_KEY = 'ada.auth';

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    hydrate(state, action: PayloadAction<{ token: string | null; user: User | null }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.ready = true;
      state.leaving = false;
    },
    loggedIn(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.ready = true;
      state.leaving = false;
    },
    userUpdated(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    loggedOut(state) {
      state.token = null;
      state.user = null;
      state.ready = true;
      state.leaving = true;
    },
    /** A new page has opened. */
    arrived(state) {
      state.leaving = false;
    },
  },
});

export const { hydrate, loggedIn, userUpdated, loggedOut, arrived } = authSlice.actions;
export default authSlice.reducer;
