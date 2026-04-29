import React, { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageProvider';
import { useAuth } from './hooks/useAuth';
import { Loader2 } from 'lucide-react';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import OtpPage from './pages/auth/OtpPage';
import NamePage from './pages/auth/NamePage';

// SuperAdmin Layout & Pages
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import DashboardPage from './pages/superadmin/DashboardPage';
import SystemConfigPage from './pages/superadmin/SystemConfigPage';
import TemplateBuilderPage from './pages/superadmin/TemplateBuilderPage';
import LawyersPage from './pages/superadmin/LawyersPage';
import LawyerFormPage from './pages/superadmin/LawyerFormPage';
import DisputesPage from './pages/superadmin/DisputesPage';
import SuperAdminJobsPage from './pages/superadmin/SuperAdminJobsPage';
import SuperAdminDocumentsPage from './pages/superadmin/SuperAdminDocumentsPage';

// User Layout & Pages
import UserLayout from './pages/user/UserLayout';
import UserDashboard from './pages/user/DashboardPage';
import ChatPage from './pages/user/ChatPage';
import DocumentsPage from './pages/user/documents/DocumentsPage';
import WizardPage from './pages/user/documents/WizardPage';
import DocumentDetailPage from './pages/user/documents/DocumentDetailPage';
import UserLawyersPage from './pages/user/lawyers/LawyersPage';
import LawyerProfilePage from './pages/user/lawyers/LawyerProfilePage';
import JobsPage from './pages/user/jobs/JobsPage';
import JobPostPage from './pages/user/jobs/JobPostPage';
import JobDetailPage from './pages/user/jobs/JobDetailPage';
import MessagesPage from './pages/user/messages/MessagesPage';
import SettingsPage from './pages/user/settings/SettingsPage';

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean; error: Error | null; errorInfo?: React.ErrorInfo }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error with component stack for debugging
    console.error('🔴 App Error Boundary Caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Store in sessionStorage for cross-session debugging
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      };
      
      const existing = sessionStorage.getItem('app_critical_errors');
      const errors = existing ? JSON.parse(existing) : [];
      errors.push(errorData);
      sessionStorage.setItem('app_critical_errors', JSON.stringify(errors.slice(-20)));
    } catch {
      // Ignore storage errors
    }

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-navy-950 p-4">
          <div className="bg-navy-900 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-sm mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
            {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
              <details className="text-left mb-4">
                <summary className="text-xs text-slate-500 cursor-pointer">Error Details (Dev)</summary>
                <pre className="mt-2 p-3 bg-navy-950 rounded-lg text-xs text-red-400 overflow-auto max-h-48">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl min-h-[48px] transition-colors"
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('app_critical_errors');
                  window.location.reload();
                }}
                className="px-6 py-3 bg-navy-700 hover:bg-navy-600 text-white font-semibold rounded-xl min-h-[48px] transition-colors"
              >
                Clear & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ requiredRole }: { requiredRole?: 'admin' | 'user' }): JSX.Element {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requiredRole === 'admin' && !user.roles.includes('admin')) {
    return <Navigate to="/user" replace />;
  }

  if (requiredRole === 'user' && user.roles.includes('admin') && !user.roles.includes('user') && !user.roles.includes('lawyer')) {
    return <Navigate to="/superadmin" replace />;
  }

  return <Outlet />;
}

function PublicRoute(): JSX.Element {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated && user) {
    if (user.roles.includes('admin')) {
      return <Navigate to="/superadmin" replace />;
    }
    return <Navigate to="/user" replace />;
  }

  return <Outlet />;
}

function AppRoutes(): JSX.Element {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<PublicRoute />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/otp" element={<OtpPage />} />
        <Route path="/auth/name" element={<NamePage />} />
      </Route>

      {/* SuperAdmin Routes */}
      <Route element={<ProtectedRoute requiredRole="admin" />}>
        <Route path="/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="system" element={<SystemConfigPage />} />
          <Route path="templates" element={<TemplateBuilderPage />} />
          <Route path="templates/new" element={<TemplateBuilderPage />} />
          <Route path="templates/:id" element={<TemplateBuilderPage />} />
          <Route path="lawyers" element={<LawyersPage />} />
          <Route path="lawyers/new" element={<LawyerFormPage />} />
          <Route path="lawyers/:id" element={<LawyerFormPage />} />
          <Route path="disputes" element={<DisputesPage />} />
          <Route path="jobs" element={<SuperAdminJobsPage />} />
          <Route path="documents" element={<SuperAdminDocumentsPage />} />
          <Route path="automations" element={<TemplateBuilderPage />} />
          <Route path="audit" element={<SystemConfigPage />} />
          <Route path="settings" element={<SystemConfigPage />} />
        </Route>
      </Route>

      {/* User Routes */}
      <Route element={<ProtectedRoute requiredRole="user" />}>
        <Route path="/user" element={<UserLayout />}>
          <Route index element={<UserDashboard />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/:sessionId" element={<ChatPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/new" element={<WizardPage />} />
          <Route path="documents/wizard" element={<WizardPage />} />
          <Route path="documents/:id" element={<DocumentDetailPage />} />
          <Route path="lawyers" element={<UserLawyersPage />} />
          <Route path="lawyers/:id" element={<LawyerProfilePage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="jobs/post" element={<JobPostPage />} />
          <Route path="jobs/:id" element={<JobDetailPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="messages/:id" element={<MessagesPage />} />
          <Route path="messages/new" element={<MessagesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Default Redirect */}
      <Route path="/" element={<Navigate to="/auth/login" replace />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}

export default function App(): JSX.Element {
  return (
    <AppErrorBoundary>
      <LanguageProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </LanguageProvider>
    </AppErrorBoundary>
  );
}
