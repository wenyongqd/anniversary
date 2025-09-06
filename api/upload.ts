/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This is a Vercel Edge Function that acts as a secure backend endpoint.
// It must be placed in the /api directory of your project.

import { put } from '@vercel/blob';

// The runtime can be 'edge' or 'nodejs'. 'edge' is generally faster.
export const config = {
  runtime: 'edge',
};

// This function handles incoming requests.
export default async function handler(request: Request) {
  // --- PRE-FLIGHT CHECK: Ensure the secret token is configured on the server ---
  // Vercel automatically exposes environment variables to Edge Functions.
  // The `process.env` syntax is polyfilled by Vercel's build process.
  // @ts-ignore
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    const errorMsg = 'Storage secret is not configured. Please set the BLOB_READ_WRITE_TOKEN environment variable in your project settings.';
    console.error(`Upload failed: ${errorMsg}`);
    return new Response(errorMsg, { status: 500 });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // The request body is a ReadableStream. We can pass it directly to the blob store.
  if (!request.body) {
    return new Response('Bad Request: No body provided.', { status: 400 });
  }

  try {
    // Generate a unique filename to prevent overwriting files.
    const filename = `timelines/past-forward-${Date.now()}.json`;
    
    // Use the Vercel Blob SDK to upload the file by streaming the request body.
    // This is highly efficient as it doesn't require loading the entire file into memory.
    const { url } = await put(filename, request.body, {
      access: 'public', // Make the file publicly accessible via its URL
      contentType: 'application/json', // Set the content type for proper handling
      token: token, // **CRITICAL FIX**: Explicitly pass the token for authorization.
    });

    // Send a success response back to the frontend with the public URL of the blob.
    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // If anything goes wrong during the upload, log the error on the server
    // and send a generic "Internal Server Error" response to the client.
    console.error('Upload to Vercel Blob failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(`Internal Server Error: ${errorMessage}`, { status: 500 });
  }
}
