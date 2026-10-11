import { requirePageUser } from "@/lib/guard";
import { db } from "@/lib/db";
import { RealtimeShell } from "@/components/Realtime";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("member");
  const { n } = db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages msg JOIN matches m ON m.id = msg.match_id
       WHERE m.status = 'matched' AND (m.user_1_id = ? OR m.user_2_id = ?) AND msg.sender_id <> ? AND msg.is_read = 0`,
    )
    .get(user.id, user.id, user.id) as { n: number };
  return (
    <RealtimeShell meId={user.id} initialUnread={n}>
      <div className="pb-28">{children}</div>
    </RealtimeShell>
  );
}
