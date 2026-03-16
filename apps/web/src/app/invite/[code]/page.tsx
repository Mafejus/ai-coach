import { prisma } from '@ai-coach/db';
import Link from 'next/link';

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const invite = await prisma.invite.findUnique({ where: { code } });
  const isValid = invite && !invite.usedAt && invite.expiresAt > new Date();

  if (!isValid) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-2xl">❌</p>
          <h1 className="text-xl font-bold text-zinc-100">Pozvánka je neplatná nebo vypršela</h1>
          <p className="text-zinc-400">Požádej o novou pozvánku.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
        <div className="text-5xl">🏋️</div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Byl jsi pozván do AI Coach!</h1>
          <p className="text-zinc-400 mt-2">Tvůj osobní AI trenér pro triatlon a běh. Přihlas se a začni trénovat chytřeji.</p>
        </div>
        <a
          href={`/api/auth/signin/google?callbackUrl=/onboarding&invite=${code}`}
          className="block w-full py-3 px-6 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Přihlásit se přes Google →
        </a>
        <p className="text-xs text-zinc-500">Pozvánka je jednorázová a platí 7 dní.</p>
      </div>
    </div>
  );
}
