/**
 * Main App component with routing
 */

import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { DashboardPage, HealthPage } from './pages';
import { ClaimDetail, DocumentUpload } from './components/claims';
import { ReviewQueue, ReviewDetail } from './components/review';
import { useSocket } from './hooks/useSocket';

export default function App() {
  // Initialize socket connection and subscribe to all events
  const { subscribeToAll } = useSocket();

  // Subscribe to all events on mount
  subscribeToAll();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/upload" element={<DocumentUpload />} />
        <Route path="/claims/:id" element={<ClaimDetail />} />
        <Route path="/review" element={<ReviewQueue />} />
        <Route path="/review/:id" element={<ReviewDetail />} />
        <Route path="/health" element={<HealthPage />} />
      </Routes>
    </Layout>
  );
}
