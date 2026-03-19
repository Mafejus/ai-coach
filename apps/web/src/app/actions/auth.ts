'use server';

import { signIn as nextAuthSignIn } from '@/lib/auth';

export async function signIn(provider: string) {
  try {
    await nextAuthSignIn(provider, { redirectTo: '/' });
  } catch (error) {
    // NextAuth v5 throws a redirect error which is normal
    if ((error as any).digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Sign in error:', error);
    throw error;
  }
}
