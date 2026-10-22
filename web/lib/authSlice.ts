import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User } from './types';

export interface AuthState {
  token: string | null;
  user: User | null;
  /** false until the saved log-in has been read from this browser */
  ready: boolean;
}

const initialState: AuthState = { token: null, user: null, ready: false };
export const AUTH_KEY = 'ada.auth';

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    hydrate(state, action: PayloadAction<{ token: string | null; user: User | null }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.ready = true;
    },
    loggedIn(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.ready = true;
    },
    userUpdated(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    loggedOut(state) {
      state.token = null;
      state.user = null;
      state.ready = true;
    },
  },
});

export const { hydrate, loggedIn, userUpdated, loggedOut } = authSlice.actions;
export default authSlice.reducer;
