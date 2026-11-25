import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { User } from '../types';

interface SentPageProps {
  user: User;
}

const SentPage: React.FC<SentPageProps> = ({ user }) => {
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState('sent');

  const { data: emails, isLoading } = useQuery({
    queryKey: ['sent-emails'],
    queryFn: async () => {
      const response = await axios.get('/api/emails/sent', { withCredentials: true });
      return response.data;
    },
  });

  React.useEffect(() => {
    const path = location.pathname;
    if (path === '/scheduled') setActiveTab('scheduled');
    else if (path === '/sent') setActiveTab('sent');
  }, [location]);

  if (activeTab !== 'scheduled' && activeTab !== 'sent') {
    setActiveTab('sent');
  }

  const tabs = [
    { id: 'scheduled', name: 'Scheduled Emails' },
    { id: 'sent', name: 'Sent Emails' },
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
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-1 px-4">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={`/${tab.id}`}
                className={`inline-flex items-center px-4 py-2 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Email Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-medium text-gray-900">Sent Emails</h2>
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
                    Sent Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      Loading...
                    </td>
                  </tr>
                ) : (emails as any)?.length > 0 ? (
                  (emails as any).map((email: any) => (
                    <tr key={email.id}>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        {email.recipient}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        {email.subject}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        {email.sentAt ? new Date(email.sentAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          email.status === 'SENT'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {email.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No sent emails found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SentPage;