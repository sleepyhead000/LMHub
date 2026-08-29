import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const payload = await verifyToken(token);
  if (!payload) {
    redirect('/login');
  }

  const userId = payload.userId;

  const { rows: profileRows } = await query('SELECT credit_balance FROM profiles WHERE id = $1', [userId]);
  const profile = profileRows[0];

  const { rows: messages } = await query(
    'SELECT input_tokens, output_tokens, cost, created_at FROM messages WHERE user_id = $1',
    [userId]
  );

  const totalInput = messages?.reduce((acc, m) => acc + m.input_tokens, 0) || 0;
  const totalOutput = messages?.reduce((acc, m) => acc + m.output_tokens, 0) || 0;
  const totalCost = messages?.reduce((acc, m) => acc + Number(m.cost), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold dark:text-white">Dashboard</h1>
                <div className="flex gap-4">
                    <Link href="/chat" className="text-blue-600 hover:underline">Back to Chat</Link>
                    <Link href="/billing" className="text-blue-600 hover:underline">Billing</Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border dark:border-zinc-800 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Available Credits</h3>
                    <p className="text-3xl font-bold dark:text-white">${Number(profile?.credit_balance || 0).toFixed(4)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border dark:border-zinc-800 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Total Tokens Used</h3>
                    <p className="text-3xl font-bold dark:text-white">{(totalInput + totalOutput).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">In: {totalInput.toLocaleString()} | Out: {totalOutput.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border dark:border-zinc-800 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Total Cost Incurred</h3>
                    <p className="text-3xl font-bold dark:text-white">${totalCost.toFixed(4)}</p>
                </div>
            </div>
        </div>
    </div>
  )
}
