import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { User } from '../types';
import { Mail, X } from 'lucide-react';

const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.string().min(1, 'At least one recipient is required'),
  startTime: z.string().nullable(),
  delayBetweenEmails: z.number().min(1000, 'Minimum 1 second delay'),
  hourlyLimit: z.number().min(1, 'At least 1 email per hour'),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ open, onClose, user }) => {
  const [emailCount, setEmailCount] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      subject: '',
      body: '',
      recipients: '',
      startTime: null,
      delayBetweenEmails: 2000,
      hourlyLimit: 100,
    },
  });

  React.useState(() => {
    if (!open) {
      reset();
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;

      // Parse emails from file
      const emails = content
        .split(/\n|,/)
        .map(line => line.trim())
        .filter(line => line && /\S+@\S+\.\S+/.test(line.replace(/\r/g, '')))
        .filter((value, index, self) => self.indexOf(value) === index);

      setEmailCount(emails.length);
      setValue('recipients', emails.join('\n'));
    };
    reader.readAsText(file);
  };

  const onSubmit = async (data: ScheduleFormData) => {
    setIsSubmitting(true);
    try {
      const recipients = data.recipients
        .split(/\n|,/)
        .map(r => r.trim())
        .filter(r => r && /\S+@\S+\.\S+/.test(r));

      // Get or create a default sender
      const senderRes = await axios.get('/api/senders/default', { withCredentials: true });
      const senderId = senderRes.data?.id || 'default-sender';

      await axios.post(
        '/api/emails/schedule',
        {
          subject: data.subject,
          body: data.body,
          recipients,
          senderId,
          startTime: data.startTime || new Date().toISOString(),
          delayBetweenEmails: data.delayBetweenEmails,
          hourlyLimit: data.hourlyLimit,
        },
        { withCredentials: true }
      );

      alert(`Successfully scheduled ${recipients.length} emails!`);
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Schedule error:', error);
      alert('Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-medium text-gray-900">Compose New Email</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              {...register('subject')}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Email subject"
            />
            {errors.subject && <p className="text-red-600 text-sm">{errors.subject.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Body (HTML)</label>
            <textarea
              {...register('body')}
              rows={6}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="<h1>Hello</h1><p>Content here...</p>"
            />
            {errors.body && <p className="text-red-600 text-sm">{errors.body.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Recipients</label>
            <textarea
              {...register('recipients')}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter email addresses, one per line or comma-separated"
            />
            {errors.recipients && <p className="text-red-600 text-sm">{errors.recipients.message}</p>}

            <div className="mt-2">
              <label className="block text-sm text-gray-500">
                Or upload CSV/TXT file
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="mt-1"
              />
              {emailCount > 0 && (
                <p className="text-sm text-green-600 mt-1">
                  Detected {emailCount} email address{emailCount !== 1 ? 'es' : ''}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="datetime-local"
                {...register('startTime')}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Delay Between Emails (ms)</label>
              <input
                type="number"
                {...register('delayBetweenEmails', { valueAsNumber: true })}
                defaultValue={2000}
                min={1000}
                step={1000}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Hourly Limit</label>
              <input
                type="number"
                {...register('hourlyLimit', { valueAsNumber: true })}
                defaultValue={100}
                min={1}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Scheduling...' : 'Schedule Emails'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComposeModal;