import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    const errorMsg = 'Storage secret is not configured. Please set the BLOB_READ_WRITE_TOKEN environment variable in your project settings.';
    console.error(`Upload failed: ${errorMsg}`);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }

  try {
    const body = await request.arrayBuffer();
    const filename = `timelines/past-forward-${Date.now()}.json`;
    
    const { url } = await put(filename, body, {
      access: 'public',
      contentType: 'application/json',
      token: token,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload to Vercel Blob failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json(
      { error: `Internal Server Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}