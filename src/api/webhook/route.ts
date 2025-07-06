
// This file is deprecated and should not be used. 
// The active webhook is located at /src/app/api/webhook/route.ts
// This file can be safely deleted.
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    console.log("DEPRECATED WEBHOOK CALLED. Please use /app/api/webhook/route.ts");
    return NextResponse.json({ error: 'This webhook is deprecated.' }, { status: 404 });
}
