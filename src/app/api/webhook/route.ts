
'use server';
import { NextResponse } from 'next/server';

// This is a low-level function to read the request body as raw text.
// It bypasses any automatic parsing by Next.js/Vercel.
async function streamToText(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
    }
    const bodyUint8Array = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        bodyUint8Array.set(chunk, offset);
        offset += chunk.length;
    }
    return new TextDecoder().decode(bodyUint8Array);
}

export async function POST(request: Request) {
  try {
    // We use the raw request body stream to avoid automatic JSON parsing errors.
    if (!request.body) {
        throw new Error("Request body is missing.");
    }
    const bodyText = await streamToText(request.body);

    // Now, we return the raw text we received. This allows us to see exactly
    // what PushInPay is sending, without any errors.
    return NextResponse.json({
        success: true,
        message: 'Diagnostic webhook received successfully. Raw body attached.',
        body: bodyText,
    }, { status: 200 });

  } catch (error: any) {
    console.error('---!!! FATAL WEBHOOK DIAGNOSTIC ERROR !!!---');
    console.error(`Error Details: ${error.message}`);
    console.error(`Stack Trace: ${error.stack}`);
    return NextResponse.json({ 
        error: 'Internal Server Error during diagnostic.', 
        details: error.message 
    }, { status: 500 });
  }
}
