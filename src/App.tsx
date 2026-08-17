import { Route, Routes } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleRoute } from './routes/RoleRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { EventDetailsPage } from './pages/EventDetailsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ManagerDashboardPage } from './pages/manager/ManagerDashboardPage';
import { CreateEventPage } from './pages/manager/CreateEventPage';
import { EditEventPage } from './pages/manager/EditEventPage';
import { EventInviteesPage } from './pages/manager/EventInviteesPage';
import { AdminPage } from './pages/admin/AdminPage';

function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/e/:eventId" element={<EventDetailsPage />} />

        <Route
          path="/manager"
          element={
            <RoleRoute allow={(p) => p.role === 'event_manager' || p.role === 'super_admin'}>
              <ManagerDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/manager/events/new"
          element={
            <RoleRoute allow={(p) => p.role === 'event_manager' || p.role === 'super_admin'}>
              <CreateEventPage />
            </RoleRoute>
          }
        />
        <Route
          path="/manager/events/:eventId/edit"
          element={
            <ProtectedRoute>
              <EditEventPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/events/:eventId/invitees"
          element={
            <ProtectedRoute>
              <EventInviteesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <RoleRoute allow={(p) => p.role === 'super_admin'}>
              <AdminPage />
            </RoleRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export default App;
