import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Ticket,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';
import { Skeleton } from '../ui/Skeleton';

export function Navbar() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    setMobileMenuOpen(false);
    navigate('/');
    await signOut();
  }

  const canManageEvents = !!profile && profile.role !== 'guest';
  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-primary-700">
          <CalendarDays className="h-6 w-6" />
          Evently
        </Link>

        {/* Below `sm`, every link this app has (home/my-events/manager/admin/
            profile/sign-out) can no longer fit as icons in one row without
            risking overflow for a manager+admin account - a hamburger menu
            replaces the row entirely on mobile instead of hiding links. */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="flex items-center justify-center rounded-xl p-2 text-slate-600 hover:bg-slate-100 sm:hidden"
          aria-label={mobileMenuOpen ? 'סגירת תפריט' : 'פתיחת תפריט'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <nav className="hidden items-center gap-2 sm:flex">
          <Link
            to="/"
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            דף הבית
          </Link>

          {loading ? (
            <Skeleton className="h-9 w-24" />
          ) : user ? (
            <>
              {canManageEvents && (
                <Link
                  to="/manager"
                  className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:flex"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  ניהול אירועים
                </Link>
              )}
              {isSuperAdmin && (
                <Link
                  to="/admin"
                  className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:flex"
                >
                  <ShieldCheck className="h-4 w-4" />
                  ניהול מערכת
                </Link>
              )}
              <Link
                to="/my-events"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <Ticket className="h-4 w-4" />
                <span className="hidden sm:inline">אירועים שנרשמתי</span>
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                title={profile?.full_name ?? undefined}
              >
                <UserIcon className="h-4 w-4" />
                <span className="hidden max-w-[140px] truncate sm:inline">{profile?.full_name || 'הפרופיל שלי'}</span>
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                aria-label="התנתקות"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                התחברות
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-primary-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
              >
                הרשמה
              </Link>
            </>
          )}
        </nav>
      </div>

      {mobileMenuOpen && (
        <nav className="border-t border-slate-200 bg-white px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              דף הבית
            </Link>

            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : user ? (
              <>
                {canManageEvents && (
                  <Link
                    to="/manager"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    ניהול אירועים
                  </Link>
                )}
                {isSuperAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    ניהול מערכת
                  </Link>
                )}
                <Link
                  to="/my-events"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <Ticket className="h-4 w-4" />
                  אירועים שנרשמתי
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <UserIcon className="h-4 w-4" />
                  {profile?.full_name || 'הפרופיל שלי'}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" />
                  התנתקות
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  התחברות
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl bg-primary-600 px-3.5 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:bg-primary-700"
                >
                  הרשמה
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
