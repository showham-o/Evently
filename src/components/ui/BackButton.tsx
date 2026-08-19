import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from './Button';

interface BackButtonProps {
  label?: string;
  className?: string;
  /**
   * True when the current page has unsaved form changes. When set, clicking
   * Back shows a confirmation dialog instead of navigating immediately, so
   * edits aren't silently lost.
   */
  isDirty?: boolean;
}

// RTL convention: "back" points visually right, since reading/forward flow
// is right-to-left. Uses real browser history so it returns to wherever the
// user actually came from, regardless of which page linked here.
export function BackButton({ label = 'חזרה', className = '', isDirty = false }: BackButtonProps) {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleClick() {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    navigate(-1);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 ${className}`}
      >
        <ArrowRight className="h-4 w-4" />
        {label}
      </button>

      <Modal open={confirmOpen} title="שינויים לא שמורים" onClose={() => setConfirmOpen(false)}>
        <p className="mb-4 text-sm text-slate-600">
          יש לך שינויים שלא נשמרו. אם תצא/י מהעמוד עכשיו, השינויים יאבדו.
        </p>
        <div className="flex gap-2">
          <Button type="button" onClick={() => setConfirmOpen(false)} className="flex-1">
            הישארות בעמוד
          </Button>
          <Button type="button" variant="danger" onClick={() => navigate(-1)} className="flex-1">
            יציאה ללא שמירה
          </Button>
        </div>
      </Modal>
    </>
  );
}
