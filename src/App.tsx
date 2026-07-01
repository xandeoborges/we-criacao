import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import TimelinePage from '@/pages/TimelinePage';
import CalendarioPage from '@/pages/CalendarioPage';
import SwimlanePage from '@/pages/SwimlanePage';

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<TimelinePage />} />
            <Route path="/calendario" element={<CalendarioPage />} />
            <Route path="/swimlane" element={<SwimlanePage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
