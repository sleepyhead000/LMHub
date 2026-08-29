import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { query } from '@/lib/db'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
    apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
  })
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!
  const payload = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event: Stripe.Event

  try {
    if (!sig || !endpointSecret) return new Response('Webhook secret missing', { status: 400 })
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret)
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`Webhook Error: ${errorMsg}`)
    return new Response(`Webhook Error: ${errorMsg}`, { status: 400 })
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.metadata?.userId && session.metadata?.credits) {
        const userId = session.metadata.userId
        const creditsToAdd = Number(session.metadata.credits)
        const amount = session.amount_total ? session.amount_total / 100 : 0

        // Record transaction
        await query(
            'INSERT INTO transactions (user_id, stripe_event_id, type, amount, credits_added) VALUES ($1, $2, $3, $4, $5)',
            [userId, event.id, 'credit_purchase', amount, creditsToAdd]
        )

        // Update profile
        await query(
            'UPDATE profiles SET credit_balance = credit_balance + $1 WHERE id = $2',
            [creditsToAdd, userId]
        )
    }
  }

  return NextResponse.json({ received: true })
}
