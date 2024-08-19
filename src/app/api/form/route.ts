import { NextRequest, NextResponse } from 'next/server';

// Handle GET requests
export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Hello from Next.js!' });
}

// Handle POST requests with CORS
export async function POST(req: NextRequest) {
  // Set CORS headers to allow requests from any origin
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Parse the request body with error handling
  let body;
  // try {
  //   body = await req.json();
  // } catch (error) {
  //   return new NextResponse('Invalid JSON', { status: 400, headers });
  // }

  // Create the response with CORS headers
  const response = NextResponse.json({ message: `You sent:}` });

  // Append the CORS headers to the response
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}
