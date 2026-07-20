import { Button } from "@/components/ui/button";
import { Flower2 } from "lucide-react";

function MicrosoftLogo() {
  return (
    <svg width="17" height="17" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function SignIn({ authError }: { authError: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 stem-pattern">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Flower2 className="h-6 w-6" />
          </span>
          <div>
            <div className="font-display text-2xl font-bold tracking-tight">WAFEX</div>
            <div className="text-sm text-muted-foreground">Merchandising & credits</div>
          </div>
        </div>

        <p className="mb-5 text-center text-sm text-muted-foreground">
          Sign in with your Wafex Microsoft account to view merchandiser visits, approve credits and see upcoming orders.
        </p>

        {authError && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            Sign-in didn't complete: {authError}
          </p>
        )}

        <Button asChild className="h-12 w-full gap-2.5 text-[15px]">
          <a href="/auth/login">
            <MicrosoftLogo /> Sign in with Microsoft
          </a>
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Access is managed in Microsoft Entra by your administrator.
        </p>
      </div>
    </div>
  );
}
