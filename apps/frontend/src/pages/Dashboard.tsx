import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Users, Mail, Settings, BarChart3 } from 'lucide-react';
import { User } from '../types';

interface Stats {
  scheduled: number;
  sent: number;
  failed: number;
}

interface DashboardProps {
  user: User;
  onCompose: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onCompose }) => {
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState('scheduled');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const [scheduledRes, sentRes] = await Promise.all([
        axios.get('/api/emails/scheduled', { withCredentials: true }),
        axios.get('/api/emails/sent', { withCredentials: true }),
      ]);
      return {
        scheduled: scheduledRes.data.length,
        sent: sentRes.data.length,
        failed: sentRes.data.filter((e: any) => e.status === 'FAILED').length,
      };
    },
  });

  React.useEffect(() => {
    const path = location.pathname;
    if (path === '/scheduled') setActiveTab('scheduled');
    else if (path === '/sent') setActiveTab('sent');
  }, [location]);

  React.useEffect(() => {
    const path = location.pathname;
    if (path === '/scheduled') setActiveTab('scheduled');
    else if (path === '/sent') setActiveTab('sent');
  }, [location]);

  if (activeTab !== 'scheduled' && activeTab !== 'sent') {
    setActiveTab('scheduled');
  }

  const tabs = [
    { id: 'scheduled', name: 'Scheduled Emails', icon: Mail },
    { id: 'sent', name: 'Sent Emails', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">{user.name.charAt(0)}</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/api/auth/logout'}
            className="text-gray-500 hover:text-gray-700"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Stats */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-500">Scheduled Emails</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.scheduled ?? 0}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-500">Sent Emails</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.sent ?? 0}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-500">Failed Emails</p>
            <p className="text-2xl font-bold text-red-600">{stats?.failed ?? 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-1 px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  to={`/${tab.id}`}
                  className={`inline-flex items-center px-4 py-2 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Email Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-medium text-gray-900">
              {activeTab === 'scheduled' ? 'Scheduled Emails' : 'Sent Emails'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {activeTab === 'scheduled' ? 'Scheduled Time' : 'Sent Time'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No {activeTab === 'scheduled' ? 'scheduled' : 'sent'} emails found
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;