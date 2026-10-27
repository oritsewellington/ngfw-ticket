import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { store } from './store';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          theme="dark"
          position="top-center"
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: 'Inter, sans-serif', borderRadius: '14px' } }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
