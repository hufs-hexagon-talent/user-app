import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot } from 'recoil';
import { queryClient } from './queryClient';

import SnackbarProvider from 'react-simple-snackbar';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/scrollbar';
import './index.css';

import reportWebVitals from './reportWebVitals';
import Router from './router';
import { DomainProvider } from './contexts/DomainContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DomainProvider>
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>
          <SnackbarProvider>
            <Router />
          </SnackbarProvider>
        </QueryClientProvider>
      </RecoilRoot>
    </DomainProvider>
  </React.StrictMode>,
);

reportWebVitals();
