import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit';

export type FlashKind = 'success' | 'error' | 'info';
export interface Flash {
  id: string;
  kind: FlashKind;
  text: string;
  at: number;
  /** how many page changes it has lived through */
  pages: number;
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
        return { payload: { id: nanoid(), kind, text, at: Date.now(), pages: 0 } };
      },
    },
    dismiss(state, action: PayloadAction<string>) {
      return state.filter((f) => f.id !== action.payload);
    },
    /** Called when the page changes. A message made just before moving to a new page is shown there;
     *  it goes away on the next page change (or straight away if it's older than the given time). */
    clearOld(state, action: PayloadAction<number>) {
      return state.map((f) => ({ ...f, pages: f.pages + 1 })).filter((f) => f.pages < 2 && f.at >= action.payload);
    },
    clearAll() {
      return [];
    },
  },
});

export const { flash, dismiss, clearOld, clearAll } = flashSlice.actions;
export default flashSlice.reducer;
