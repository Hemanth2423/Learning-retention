"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { ReadingShell } from "@/components/ReadingShell";
import { TopNav } from "@/components/TopNav";
import { LevelBar } from "@/components/XpStats";
import { api } from "@/convex/_generated/api";

export default function SettingsPage() {
  return (
    <ReadingShell chrome={false}>
      <TopNav />
      <Settings />
    </ReadingShell>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:items-center">
      <dt className="text-meta font-semibold text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Settings() {
  const me = useQuery(api.users.me);
  const notion = useQuery(api.notionData.connection);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [zone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pb-20 pt-6 md:px-8">
      <p className="font-game text-label tracking-wider text-accent-dark">SETTINGS</p>
      <h1 className="mt-1 font-serif text-h1 font-bold">Your account</h1>

      <section className="mt-5 rounded-[18px] border border-line bg-card px-4 md:px-5">
        <h2 className="pt-4 font-serif text-h3 font-bold">Profile</h2>
        <dl className="divide-y divide-line">
          <Row label="Signed in as">{me === undefined ? "…" : (me?.email ?? "Unknown")}</Row>
          <Row label="Time zone">
            {zone} <span className="text-meta text-muted">· your streak day ends at midnight here</span>
          </Row>
          <Row label="Level">
            <LevelBar />
          </Row>
        </dl>
      </section>

      <section className="mt-4 rounded-[18px] border border-line bg-card px-4 md:px-5">
        <h2 className="pt-4 font-serif text-h3 font-bold">Connections</h2>
        <dl className="divide-y divide-line">
          <Row label="Notion">
            {notion === undefined ? (
              "…"
            ) : notion.connected ? (
              <span>
                <span className="rounded-full border border-good-line bg-good-soft px-2 py-0.5 text-label font-semibold text-good">Connected</span>
                {notion.workspaceName && <span className="ml-2 text-meta text-muted">{notion.workspaceName}</span>}
              </span>
            ) : (
              <span className="text-meta text-muted">
                Not connected. Connect from a book&apos;s <b>Export notes</b> sheet in your <Link className="underline" href="/read">library</Link>.
              </span>
            )}
          </Row>
        </dl>
      </section>

      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line bg-card p-4 md:px-5">
        <div>
          <h2 className="font-serif text-h3 font-bold">Sign out</h2>
          <p className="text-meta text-muted">Your library and progress stay saved.</p>
        </div>
        <button onClick={() => void signOut().then(() => router.replace("/"))} className="chunky chunky-light sm">
          Sign out
        </button>
      </section>
    </main>
  );
}
