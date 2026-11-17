import { Navigate, Route, Routes } from 'react-router';
import { Layout } from '@/components/Layout';
import { SettingsPage } from '@/features/account/SettingsPage';
import { AuthGate } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ProjectPage } from '@/features/projects/ProjectPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';

export function App() {
  return (
    <Routes>
      <Route element={<AuthGate allow="guest" />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<AuthGate allow="user" />}>
        <Route element={<Layout />}>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
