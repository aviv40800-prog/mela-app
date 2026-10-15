/**
 * Where Tranzila sends the member's browser after paying, inside the iFrame. Set the terminal's success URL to
 *   https://<site>/api/tranzila/return?result=success   and the failure URL to   ...?result=fail
 * It only tells the checkout page (the iFrame's parent) to look; the order itself is confirmed by the notify.
 */
function page(result: string) {
  const ok = result === "success";
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#1c060c;color:#f7ece6;font:16px system-ui,sans-serif;text-align:center}</style></head>
<body><div><div style="font-size:40px">${ok ? "✓" : "✕"}</div><p>${ok ? "התשלום התקבל, רגע אחד…" : "התשלום לא עבר. אפשר לנסות שוב."}</p></div>
<script>try{parent.postMessage({mela:"tranzila",result:${JSON.stringify(ok ? "success" : "fail")}},location.origin)}catch(e){}</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  return page(new URL(req.url).searchParams.get("result") ?? "");
}
export async function POST(req: Request) {
  return page(new URL(req.url).searchParams.get("result") ?? "");
}
