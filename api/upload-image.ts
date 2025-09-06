/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This is a new Vercel Edge Function dedicated to uploading single image files.
// It must be placed in the /api directory of your project.

import { put } from '@vercel/blob';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // @ts-ignore
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return new Response('Storage secret is not configured.', { status: 500 });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  if (!request.body) {
    return new Response('Bad Request: No body provided.', { status: 400 });
  }

  // Get the content type from the request headers to pass to the blob store.
  const contentType = request.headers.get('content-type') || 'application/octet-stream';
  const fileExtension = contentType.split('/')[1] || 'jpeg';

  try {
    const filename = `images/photo-${Date.now()}.${fileExtension}`;
    
    const { url } = await put(filename, request.body, {
      access: 'public',
      contentType: contentType,
      token: token,
    });

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Image upload to Vercel Blob failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
}