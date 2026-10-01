import { lazy, Suspense } from 'react';
import AuthScreen from './components/AuthScreen';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabaseClient';
import authStyles from './components/AuthScreen.module.css';

const Board = lazy(() => import('./components/Board'));

function LoadingSplash() {
  return (
    <div className={authStyles.page}>
      <div className={authStyles.logo} aria-hidden="true">
        FB
      </div>
    </div>
  );
}

function App() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingSplash />;
  if (!session) return <AuthScreen />;

  return (
    <Suspense fallback={<LoadingSplash />}>
      <Board userEmail={session.user.email ?? ''} onSignOut={() => supabase.auth.signOut()} />
    </Suspense>
  );
}

export default App;
