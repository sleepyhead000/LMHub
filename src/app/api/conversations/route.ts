import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rows } = await query(
      'SELECT id, title, model, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
