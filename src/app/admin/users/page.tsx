import Link from "next/link";
import { BadgeCheck, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { genderSplit, listUsers, USER_FILTERS, type UserFilter } from "@/lib/admin-data";
import { Badge, PageHeader, Stat, SUB_BADGE, UserChip, when } from "@/components/admin/ui";
import { CleanupPanel } from "@/components/admin/CleanupPanel";
import { adminEmails } from "@/lib/admin";
import { getUser } from "@/lib/users";
import { signupStage, stageTag } from "@/lib/signup-stage";

type SP = Promise<{ q?: string; filter?: string; page?: string }>;

export default async function AdminUsers({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filter = (sp.filter && sp.filter in USER_FILTERS ? sp.filter : "all") as UserFilter;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q ?? "";
  const { rows, total, pages } = listUsers({ q, filter, page, perPage: filter === "real" || filter === "demo" ? 200 : 25 });
  const admins = adminEmails();
  const split = genderSplit();
  // where each member who hasn't finished their profile stopped
  const stage = (id: number) => {
    const u = getUser(id);
    return u && !u.is_demo ? stageTag(signupStage(u)) : null;
  };
  const href = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(q && { q }), filter, page: String(page), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    return `/admin/users?${p}`;
  };

  return (
    <>
      <PageHeader eyebrow="ניהול" title="משתמשים">
        <span className="tabular text-sm text-mute">{total.toLocaleString("he-IL")} תוצאות</span>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3">
        {(
          [
            ["women", "נשים", split.female, "מוצגות", "משלמות"],
            ["men", "גברים", split.male, "מוצגים", "משלמים"],
          ] as const
        ).map(([f, label, g, shown, pay]) => (
          <Link key={f} href={href({ filter: f, page: 1 })} className="block transition hover:opacity-90">
            <Stat label={label} value={g.total} accent={f === filter} sub={`${g.visible} ${shown} בגילוי · ${g.paying} ${pay}`} />
          </Link>
        ))}
      </div>
      {split.unknown > 0 && <p className="-mt-3 mb-4 text-[12px] text-mute-2">{split.unknown} נרשמו ועוד לא בחרו מגדר</p>}

      <form className="flex flex-wrap items-center gap-3" action="/admin/users">
        <input type="hidden" name="filter" value={filter} />
        <label className="field flex max-w-md flex-1 items-center gap-2 !py-0">
          <Search size={16} className="shrink-0 text-mute" />
          <input name="q" defaultValue={q} placeholder="חיפוש לפי שם, טלפון, אימייל, עיר או עיסוק" className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-mute-2" />
        </label>
        <button className="btn-gold py-2.5 text-sm">חיפוש</button>
      </form>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(USER_FILTERS) as UserFilter[]).map((f) => (
          <Link
            key={f}
            href={href({ filter: f, page: 1 })}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition ${f === filter ? "bg-gold text-[#2a1c12] font-semibold" : "border border-line-2 text-mute hover:text-cream"}`}
          >
            {USER_FILTERS[f].label}
          </Link>
        ))}
      </div>

      {(filter === "demo" || filter === "real") && !q && (
        <CleanupPanel
          mode={filter}
          demoCount={filter === "demo" ? total : 0}
          rows={rows.map((u) => ({
            id: u.id,
            name: u.full_name ?? "(בלי שם)",
            full: !!u.full_name,
            sub: [u.email ?? u.phone_number, when(u.created_at)].filter(Boolean).join(" · "),
            admin: !!u.email && admins.includes(u.email.toLowerCase()),
          }))}
        />
      )}

      {/* desktop table */}
      <div className="surface mt-5 hidden overflow-hidden rounded-[20px] md:block">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-line text-[12px] text-mute">
            <tr>
              {["משתמש", "גיל", "טלפון", "מנוי", "התאמות", "הצטרף/ה", "נראה/תה לאחרונה", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-fg/[0.025]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <UserChip id={u.id} name={u.full_name} photo={u.photo} sub={[u.location, u.email].filter(Boolean).join(" · ")} />
                    {u.is_verified && <BadgeCheck size={14} className="shrink-0 text-gold-2" />}
                  </div>
                </td>
                <td className="tabular px-4 py-3 text-mute">
                  {u.age ?? "—"} {u.gender === "female" ? "♀" : u.gender === "male" ? "♂" : ""}
                </td>
                <td className="tabular px-4 py-3 text-mute" dir="ltr" style={{ textAlign: "right" }}>
                  {u.phone_number ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.sub_status ? <Badge tone={SUB_BADGE[u.sub_status].tone}>{SUB_BADGE[u.sub_status].label}</Badge> : <Badge>ללא</Badge>}
                    {u.is_demo && <Badge>דמו</Badge>}
                    {u.is_banned && <Badge tone="red">מושעה</Badge>}
                    {stage(u.id) && <Badge tone="red">{stage(u.id)}</Badge>}
                  </div>
                </td>
                <td className="tabular px-4 py-3">{u.matches}</td>
                <td className="px-4 py-3 text-mute">{when(u.created_at)}</td>
                <td className="px-4 py-3 text-mute">{when(u.last_seen_at)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="text-mute-2 hover:text-gold-2" aria-label="פרטים">
                    <ChevronLeft size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-mute">לא נמצאו משתמשים.</p>}
      </div>

      {/* mobile cards */}
      <ul className="mt-5 space-y-2 md:hidden">
        {rows.map((u) => (
          <li key={u.id} className="surface flex items-center justify-between gap-3 rounded-2xl p-3">
            <UserChip id={u.id} name={u.full_name} photo={u.photo} sub={`${u.age ?? "—"} · ${u.location ?? u.email ?? u.phone_number ?? ""}`} />
            <div className="flex shrink-0 flex-col items-end gap-1">
              {u.sub_status && <Badge tone={SUB_BADGE[u.sub_status].tone}>{SUB_BADGE[u.sub_status].label}</Badge>}
              {u.is_banned ? <Badge tone="red">מושעה</Badge> : u.is_demo ? <Badge>דמו</Badge> : null}
              {stage(u.id) && <Badge tone="red">{stage(u.id)}</Badge>}
            </div>
          </li>
        ))}
        {rows.length === 0 && <p className="p-8 text-center text-sm text-mute">לא נמצאו משתמשים.</p>}
      </ul>

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="דפים">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="btn-ghost px-3 py-2" aria-label="הקודם">
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span className="w-10" />
          )}
          <span className="tabular text-mute">
            עמוד {page} מתוך {pages}
          </span>
          {page < pages ? (
            <Link href={href({ page: page + 1 })} className="btn-ghost px-3 py-2" aria-label="הבא">
              <ChevronLeft size={16} />
            </Link>
          ) : (
            <span className="w-10" />
          )}
        </nav>
      )}
    </>
  );
}
