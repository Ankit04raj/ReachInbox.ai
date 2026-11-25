import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ScheduledPage from './pages/ScheduledPage';
import SentPage from './pages/SentPage';
import ComposeModal from './components/ComposeModal';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

const fetchCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await axios.get('/api/auth/me', { withCredentials: true });
    return response.data.user;
  } catch (error) {
    return null;
  }
};

const App: React.FC = () => {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
  });

  const [composeOpen, setComposeOpen] = React.useState(false);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const isAuthenticated = !!user;

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route
          path="/login"
          element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard user={user!} onCompose={() => setComposeOpen(true)} /> : <Navigate to="/login" />}
        />
        <Route
          path="/scheduled"
          element={isAuthenticated ? <ScheduledPage user={user!} /> : <Navigate to="/login" />}
        />
        <Route
          path="/sent"
          element={isAuthenticated ? <SentPage user={user!} /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
      </Routes>

      {isAuthenticated && (
        <ComposeModal
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          user={user!}
        />
      )}
    </div>
  );
};

export default App;