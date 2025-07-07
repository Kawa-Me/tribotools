'use server';
import { NextResponse } from 'next/server';

// This is a diagnostic step to inspect headers without parsing the body.
export async function POST(request: Request) {
  try {
    const headers: { [key: string]: string } = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // This response does not touch the request body, so it should not fail.
    // It will show us exactly what headers are being sent by the payment provider.
    return NextResponse.json(
      {
        success: true,
        message: 'Diagnostic (Headers) webhook received successfully.',
        headers: headers,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('---!!! FATAL WEBHOOK DIAGNOSTIC ERROR !!!---');
    console.error(`Error Details: ${error.message}`);
    console.error(`Stack Trace: ${error.stack}`);
    return NextResponse.json(
      {
        error: 'Internal Server Error during diagnostic.',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
