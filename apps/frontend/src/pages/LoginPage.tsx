import React from 'react';

const LoginPage: React.FC = () => {
  const handleLogin = () => {
    // Redirect to backend Google OAuth
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ReachInbox
        </h1>
        <p className="text-gray-600 mb-8">
          Email Scheduling & Automation Platform
        </p>
        <button
          onClick={handleLogin}
          className="flex items-center justify-center w-full max-w-sm mx-auto px-6 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 533 544">
            <path
              fill="#4285F4"
              d="M530.9 275.1c0-18.5-1.6-36.1-4.6-52.8H272v100.3h147.7c-6.4 34.8-25.5 64.2-54.5 84.1v69.3h88.4c51.1-47.5 81.7-117.7 81.7-201z"
            />
            <path
              fill="#34A853"
              d="M272 543.1c73.6 0 135.4-24.5 180.3-66.8l-88.4-69.3c-24.5 16.4-55.6 26.2-91.9 26.2-70.4 0-129.8-47.5-151.8-112.2H48.7v73.5C92.8 473.3 179.5 543.1 272 543.1z"
            />
            <path
              fill="#FBBC05"
              d="M83.1 322.4l-27.3-19.7C27.8 283.8 14.6 254.3 14.6 222.1c0-32.2 13.1-61.7 36.7-85.4V46.5H83.1C128.3 54.2 192.7 87.5 192.7 156.3c0 26.9-7.3 53.3-20.5 76.4l27.3 19.8C189.5 194.8 265.1 168.1 326.1 213.6c15.8 11.5 29 25 39.3 40.3l10.4-7.8C306.2 301.5 192.7 244.9 192.7 156.3z"
            />
            <path
              fill="#EA4335"
              d="M272 107.2c40.1 0 75.6 13.9 104.2 39.4l78.4-78.4C372.7 14.4 319.1-5.7 262.8 0C198.9 2.3 141.1 37.3 103.3 96.8l81.7 67.4C152.4 143.2 208.7 107.2 272 107.2z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;