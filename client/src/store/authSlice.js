import { createSlice } from '@reduxjs/toolkit';

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be blocked (private mode): the app still works for this visit */
  }
};

const slice = createSlice({
  name: 'auth',
  initialState: { token: read('ngfw_token'), user: read('ngfw_user'), scannerToken: read('ngfw_scanner') },
  reducers: {
    setCredentials(state, { payload }) {
      state.token = payload.token;
      state.user = payload.user;
      write('ngfw_token', payload.token);
      write('ngfw_user', payload.user);
    },
    logout(state) {
      state.token = null;
      state.user = null;
      write('ngfw_token', null);
      write('ngfw_user', null);
    },
    setScannerToken(state, { payload }) {
      state.scannerToken = payload;
      write('ngfw_scanner', payload);
    },
  },
});

export const { setCredentials, logout, setScannerToken } = slice.actions;
export default slice.reducer;
