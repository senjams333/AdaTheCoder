import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit';

export type FlashKind = 'success' | 'error' | 'info';
export interface Flash {
  id: string;
  kind: FlashKind;
  text: string;
  at: number;
}

/** Short messages ("Saved.", "Wrong password.") shown at the top of the next page. */
const flashSlice = createSlice({
  name: 'flash',
  initialState: [] as Flash[],
  reducers: {
    flash: {
      reducer(state, action: PayloadAction<Flash>) {
        state.push(action.payload);
      },
      prepare(kind: FlashKind, text: string) {
        return { payload: { id: nanoid(), kind, text, at: Date.now() } };
      },
    },
    dismiss(state, action: PayloadAction<string>) {
      return state.filter((f) => f.id !== action.payload);
    },
    /** Called when the page changes: messages from before the change go away. */
    clearOld(state, action: PayloadAction<number>) {
      return state.filter((f) => f.at >= action.payload);
    },
    clearAll() {
      return [];
    },
  },
});

export const { flash, dismiss, clearOld, clearAll } = flashSlice.actions;
export default flashSlice.reducer;
