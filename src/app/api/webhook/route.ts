
'use server';

import { NextResponse } from 'next/server';

/**
 * A temporary diagnostic webhook handler.
 * Its only purpose is to receive a request from the payment provider,
 * log the raw body text, and return it in the response.
 * This helps us debug the exact format of the incoming data without
 * any other logic interfering.
 */
export async function POST(request: Request) {
  try {
    const bodyText = await request.text();

    // Log to Vercel's server logs for debugging.
    console.log('Webhook Raw Body Received:', bodyText);

    // Return a successful response containing the raw body.
    // This allows us to see the body in the PushInPay panel.
    return NextResponse.json({
        success: true,
        message: 'Diagnostic webhook received successfully. Raw body attached.',
        body: bodyText,
    }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Log the error to Vercel's server logs.
    console.error('---!!! FATAL WEBHOOK DIAGNOSTIC ERROR !!!---', error);
    
    // Return the specific error message for debugging.
    return NextResponse.json({ 
        error: 'Internal Server Error during diagnostic.', 
        details: errorMessage 
    }, { status: 500 });
  }
}
