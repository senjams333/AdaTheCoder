import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import auth from './authSlice';
import flash from './flashSlice';

export function makeStore() {
  return configureStore({
    reducer: { auth, flash, [api.reducerPath]: api.reducer },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
