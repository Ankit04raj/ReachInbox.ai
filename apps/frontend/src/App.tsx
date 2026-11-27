import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
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
    if (axios.isAxiosError(error) && error.response?.status === 401) return null;
    throw error;
  }
};

const App: React.FC = () => {
  const { data: user, isLoading, isError, refetch } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
  });

  const [composeOpen, setComposeOpen] = React.useState(false);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (isError) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1>Unable to connect</h1><p>Check that the backend is running.</p><button onClick={()=>refetch()}>Retry</button></div></div>;
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
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
        />
        <Route
          path="/sent"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
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