import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function BillingPage() {
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold dark:text-white">Billing & Credits</h1>
                <div className="flex gap-4">
                    <Link href="/chat" className="text-blue-600 hover:underline">Back to Chat</Link>
                    <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border dark:border-zinc-800 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-semibold dark:text-white">Credit Balance</h2>
                        <p className="text-gray-500">Your current balance for API usage.</p>
                    </div>
                    <div className="text-3xl font-bold text-blue-600">${Number(profile?.credit_balance || 0).toFixed(4)}</div>
                </div>

                <h3 className="text-lg font-medium mb-4 dark:text-white">Buy Credits</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[5, 10, 20].map((amount) => (
                        <form key={amount} action="/api/stripe/checkout" method="POST">
                            <input type="hidden" name="amount" value={amount} />
                            <button type="submit" className="w-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 border dark:border-zinc-700 p-4 rounded-lg flex flex-col items-center gap-2 transition-colors">
                                <span className="text-2xl font-bold dark:text-white">${amount}</span>
                                <span className="text-sm text-gray-500">Add ${amount} credits</span>
                            </button>
                        </form>
                    ))}
                </div>
            </div>
        </div>
    </div>
  )
}
