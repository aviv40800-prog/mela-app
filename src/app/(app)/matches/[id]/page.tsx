import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/guard";
import { matchPartner } from "@/lib/matching";
import { listMessages } from "@/lib/chat";
import { toPublic } from "@/lib/users";
import { datePlan } from "@/lib/dates";
import { sharedAnswers } from "@/lib/checkin";
import { ChatRoom } from "@/components/ChatRoom";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePageUser("member");
  const matchId = Number((await params).id);
  const partner = Number.isInteger(matchId) ? matchPartner(matchId, me.id) : null;
  if (!partner) notFound();
  return (
    <ChatRoom
      matchId={matchId}
      meId={me.id}
      partner={toPublic(partner)}
      initial={listMessages(matchId)}
      plan={datePlan(me, partner)}
      shared={sharedAnswers(me.id, partner.id, 3)}
    />
  );
}
