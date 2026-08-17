import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { PageSkeleton } from '../components/ui/Skeleton';
import type { Profile } from '../lib/supabase/types';

interface RoleRouteProps {
  allow: (profile: Profile) => boolean;
  children: ReactNode;
}

export function RoleRoute({ allow, children }: RoleRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile || !allow(profile)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
