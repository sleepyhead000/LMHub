import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
    apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
  })
  try {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    const formData = await req.formData()
    const amount = Number(formData.get('amount'))

    if (!amount || amount < 1) {
        return NextResponse.redirect(new URL('/billing?error=invalid_amount', req.url))
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Add $${amount} AI Credits`,
            },
            unit_amount: amount * 100, // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/billing?canceled=true`,
      metadata: {
          userId: userId,
          credits: amount
      }
    })

    if (session.url) {
         return NextResponse.redirect(session.url, 303)
    }

    return NextResponse.redirect(new URL('/billing?error=session_creation_failed', req.url))
  } catch (err) {
    console.error(err)
    return NextResponse.redirect(new URL('/billing?error=server_error', req.url))
  }
}
