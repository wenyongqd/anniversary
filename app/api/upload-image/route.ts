import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Storage secret is not configured.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.arrayBuffer();
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const fileExtension = contentType.split('/')[1] || 'jpeg';
    const filename = `images/photo-${Date.now()}.${fileExtension}`;
    
    const { url } = await put(filename, body, {
      access: 'public',
      contentType: contentType,
      token: token,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Image upload to Vercel Blob failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json(
      { error: `Internal Server Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}