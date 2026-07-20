import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ProductsPage } from './pages/ProductsPage';
import { NewSalePage } from './pages/NewSalePage';
import { SalesPage } from './pages/SalesPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1f4b7a',
          borderRadius: 6,
          fontFamily:
            '"IBM Plex Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/new-sale" element={<NewSalePage />} />
                  <Route path="/sales" element={<SalesPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/products" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
