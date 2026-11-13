import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import WorkflowsList from './pages/WorkflowsList';
import WorkflowBuilder from './pages/WorkflowBuilder';
import WorkflowDetails from './pages/WorkflowDetails';
import LiveMonitor from './pages/LiveMonitor';
import RecoveryLab from './pages/RecoveryLab';
import AslEditor from './pages/AslEditor';
import ExecutionHistory from './pages/ExecutionHistory';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-[#070B14] text-slate-400 font-mono text-xs">
        Verifying cryptographic session...
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected App Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="workflows" element={<WorkflowsList />} />
              <Route path="workflows/new" element={<WorkflowBuilder />} />
              <Route path="workflows/:id" element={<WorkflowDetails />} />
              <Route path="workflows/:id/edit" element={<WorkflowBuilder />} />
              <Route path="executions" element={<ExecutionHistory />} />
              <Route path="executions/:id" element={<LiveMonitor />} />
              <Route path="lab" element={<RecoveryLab />} />
              <Route path="asl" element={<AslEditor />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

