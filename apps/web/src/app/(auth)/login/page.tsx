import GoogleLoginButton from '@/components/auth/GoogleLoginButton';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">🏋️ AI Coach</h1>
          <p className="mt-2 text-muted-foreground">Přihlaste se pro přístup k tréninkovému plánu</p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <GoogleLoginButton />
        </div>
      </div>
    </div>
  );
}
