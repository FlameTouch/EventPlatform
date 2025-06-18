import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { createOrder } from '@/lib/actions/order.actions'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()

  const sig = request.headers.get('stripe-signature') as string
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err) {
    return NextResponse.json({ message: 'Webhook error', error: err })
  }

  // Get the ID and type
  const eventType = event.type

  // CREATE
  if (eventType === 'checkout.session.completed') {
    const { id, amount_total, metadata } = event.data.object as Stripe.Checkout.Session

    if (!metadata?.buyerId || !metadata?.eventId) {
      console.error('❗ Missing required metadata fields:', metadata)
      return NextResponse.json({ message: 'Missing required metadata fields', metadata }, { status: 400 })
    }

    const order = {
      stripeId: id,
      eventId: metadata.eventId || '',
      buyerId: metadata.buyerId || '',
      totalAmount: amount_total ? (amount_total / 100).toString() : '0',
      createdAt: new Date(),
    }

    try {
      const newOrder = await createOrder(order)
      return NextResponse.json({ message: 'Order created', order: newOrder })
    } catch (error) {
      console.error('❗ Ошибка при создании заказа:', error)
      return NextResponse.json({ message: 'Failed to create order', error }, { status: 500 })
    }
  }

  return new Response('', { status: 200 })
}