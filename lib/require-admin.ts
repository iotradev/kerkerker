import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';

/** 访客管理类接口统一鉴权，失败时返回 401 响应 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await validateSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
