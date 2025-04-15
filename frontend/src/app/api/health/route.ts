import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch('http://localhost:8000/health')
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to connect to backend' },
      { status: 500 }
    )
  }
} 