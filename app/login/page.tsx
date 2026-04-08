import { redirect } from 'next/navigation';
import { isSessionAuthorized } from '@/backend/services/session';
import { LoginForm } from '@/app/components/login-form';

export default async function LoginPage() {
  const authorized = await isSessionAuthorized();
  if (authorized) {
    redirect('/');
  }

  return (
    <main className="page">
      <LoginForm />
    </main>
  );
}

