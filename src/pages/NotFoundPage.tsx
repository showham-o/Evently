import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <PageContainer>
      <EmptyState
        icon={Compass}
        title="הדף לא נמצא"
        description="הכתובת שביקשתם אינה קיימת"
        action={
          <Link to="/">
            <Button>חזרה לדף הבית</Button>
          </Link>
        }
      />
    </PageContainer>
  );
}
