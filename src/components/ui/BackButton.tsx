import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  label?: string;
  className?: string;
}

// RTL convention: "back" points visually right, since reading/forward flow
// is right-to-left. Uses real browser history so it returns to wherever the
// user actually came from, regardless of which page linked here.
export function BackButton({ label = 'חזרה', className = '' }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 ${className}`}
    >
      <ArrowRight className="h-4 w-4" />
      {label}
    </button>
  );
}
