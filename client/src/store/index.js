import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import auth from './authSlice';

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer, auth },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});
