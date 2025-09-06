import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    );
  }
  
  return NextResponse.json({ apiKey });
}