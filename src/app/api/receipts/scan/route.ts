import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { itemKey } from "@/lib/shopping";
import { proposePayers, type ItemPart } from "@/lib/split";

// Llegir un tiquet pot trigar uns segons
export const maxDuration = 60;

type ListItem = {
  id: string;
  ingredient_id: string | null;
  custom_name: string | null;
  quantity: number | null;
  unit: string | null;
  for_user_id: string | null;
  for_subgroup_id: string | null;
  ingredients: { name: string } | null;
};

type Product = { name: string; unit: string | null; ids: string[]; parts: ItemPart[] };

type Scan = {
  store_name: string | null;
  purchased_at: string | null;
  total: number | null;
  lines: { description: string; quantity: number; amount: number; match: number[] }[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["store_name", "purchased_at", "total", "lines"],
  properties: {
    store_name: { anyOf: [{ type: "string" }, { type: "null" }], description: "Nom del supermercat o botiga" },
    purchased_at: { anyOf: [{ type: "string" }, { type: "null" }], description: "Data de la compra en format AAAA-MM-DD" },
    total: { anyOf: [{ type: "number" }, { type: "null" }], description: "Total final pagat, en euros" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "amount", "match"],
        properties: {
          description: { type: "string", description: "Nom del producte tal com surt al tiquet, més llegible si cal" },
          quantity: { type: "number", description: "Unitats o pes comprat; 1 si no surt" },
          amount: { type: "number", description: "Import final de la línia en euros; negatiu si és un descompte" },
          match: {
            type: "array",
            items: { type: "integer" },
            description: "Números dels productes de la llista que corresponen a aquesta línia; buit si cap",
          },
        },
      },
    },
  },
} as const;

function errorJson(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return errorJson("Falta la clau ANTHROPIC_API_KEY a la configuració del servidor.", 500);
  }

  const { receiptId } = (await request.json().catch(() => ({}))) as { receiptId?: string };
  if (!receiptId) return errorJson("Falta el tiquet.", 400);

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return errorJson("Has d'entrar a l'app.", 401);

  const { data: receipt } = await sb
    .from("receipts")
    .select("id, group_id, shopping_list_id, image_path, shopping_lists(subgroup_id)")
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt) return errorJson("No trobem aquest tiquet.", 404);
  if (!receipt.image_path) return errorJson("Aquest tiquet no té foto.", 400);

  // Foto del tiquet
  const { data: blob, error: dlError } = await sb.storage.from("receipts").download(receipt.image_path);
  if (dlError || !blob) return errorJson("No s'ha pogut obrir la foto del tiquet.", 500);
  const mediaType = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(blob.type)
    ? blob.type
    : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const imageData = Buffer.from(await blob.arrayBuffer()).toString("base64");

  // Persones que poden pagar
  let members: string[] = [user.id];
  if (receipt.group_id) {
    const { data: gm } = await sb.from("group_members").select("user_id").eq("group_id", receipt.group_id);
    members = (gm ?? []).map((m: { user_id: string }) => m.user_id);
    // Si la llista és d'un subgrup, el que és comú es reparteix només entre ells
    const subgroupId = (receipt.shopping_lists as unknown as { subgroup_id: string | null } | null)?.subgroup_id;
    if (subgroupId) {
      const { data: sm } = await sb.from("subgroup_members").select("user_id").eq("subgroup_id", subgroupId);
      const ids = new Set((sm ?? []).map((m: { user_id: string }) => m.user_id));
      const inSubgroup = members.filter((m) => ids.has(m));
      if (inSubgroup.length) members = inSubgroup;
    }
  }

  // Productes de la llista de la compra, agrupats igual que a la pantalla de la llista
  const products: Product[] = [];
  if (receipt.shopping_list_id) {
    const { data: items } = await sb
      .from("shopping_list_items")
      .select("id, ingredient_id, custom_name, quantity, unit, for_user_id, for_subgroup_id, ingredients(name)")
      .eq("list_id", receipt.shopping_list_id);
    // Gent de cada subgrup, per repartir el que és d'un subgrup (el menjar del gos)
    const subIds = [
      ...new Set(((items ?? []) as unknown as ListItem[]).map((i) => i.for_subgroup_id).filter(Boolean)),
    ] as string[];
    const subMembers = new Map<string, string[]>();
    if (subIds.length) {
      const { data: sm } = await sb.from("subgroup_members").select("subgroup_id, user_id").in("subgroup_id", subIds);
      for (const m of (sm ?? []) as { subgroup_id: string; user_id: string }[]) {
        subMembers.set(m.subgroup_id, [...(subMembers.get(m.subgroup_id) ?? []), m.user_id]);
      }
    }
    const byKey = new Map<string, Product>();
    for (const i of (items ?? []) as unknown as ListItem[]) {
      const k = itemKey(i);
      const p = byKey.get(k) ?? {
        name: i.ingredients?.name ?? i.custom_name ?? "",
        unit: i.unit,
        ids: [],
        parts: [],
      };
      p.ids.push(i.id);
      p.parts.push({
        for_user_id: i.for_user_id,
        quantity: i.quantity,
        subgroup_members: i.for_subgroup_id ? subMembers.get(i.for_subgroup_id) ?? [] : null,
      });
      byKey.set(k, p);
    }
    products.push(...byKey.values());
  }

  const listText = products.length
    ? products
        .map((p, n) => {
          const qty = p.parts.reduce((a, x) => a + Number(x.quantity ?? 0), 0);
          return `${n}. ${p.name}${qty && p.unit ? ` (${qty} ${p.unit})` : ""}`;
        })
        .join("\n")
    : "(no hi ha llista)";

  const prompt = `Aquesta foto és un tiquet de supermercat. Extreu-ne les línies de producte.

Normes:
- Una línia per producte cobrat. Si el tiquet diu "2 x 1,50", la quantitat és 2 i l'import 3,00.
- Els descomptes i promocions que restin van com a línia pròpia amb import negatiu.
- No posis com a línies el subtotal, el total, l'IVA, el canvi ni la forma de pagament.
- Escriu la descripció en minúscules i desfés les abreviatures quan sigui evident (per exemple "PIT POLL" és "pit de pollastre").
- L'import és el que finalment es cobra per aquella línia, en euros i amb punt decimal.

Llista de la compra amb què l'has de relacionar:
${listText}

A "match" posa el número dels productes de la llista que corresponen a cada línia. Una línia pot correspondre a més d'un producte i un producte pot aparèixer en més d'una línia. Si no estàs segur, deixa-ho buit.`;

  const anthropic = new Anthropic();
  let scan: Scan;
  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 8000,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageData } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text");
    scan = JSON.parse(text && text.type === "text" ? text.text : "{}") as Scan;
    if (!Array.isArray(scan.lines)) throw new Error("sense línies");
  } catch (err) {
    console.error("scan error", err);
    return errorJson("No s'ha pogut llegir el tiquet. Prova amb una foto més nítida o afegeix les línies a mà.", 502);
  }

  // Desa les línies (si es torna a llegir, substitueix les anteriors)
  await sb.from("receipt_lines").delete().eq("receipt_id", receiptId);

  const rows = scan.lines.map((l, position) => {
    const matched = [...new Set(l.match)].filter((n) => Number.isInteger(n) && products[n]);
    return {
      receipt_id: receiptId,
      description: l.description.slice(0, 200),
      quantity: l.quantity || 1,
      amount: Math.round(Number(l.amount) * 100) / 100,
      position,
      matched_item_ids: matched.flatMap((n) => products[n].ids),
      _parts: matched.flatMap((n) => products[n].parts),
    };
  });

  const { data: inserted, error: insError } = await sb
    .from("receipt_lines")
    .insert(rows.map(({ _parts, ...r }) => (void _parts, r)))
    .select("id, position");
  if (insError || !inserted) return errorJson("No s'han pogut desar les línies del tiquet.", 500);

  // Proposta de qui paga cada línia
  const payers: { line_id: string; user_id: string; share: number }[] = [];
  for (const line of inserted as { id: string; position: number }[]) {
    const parts = rows[line.position]._parts;
    if (parts.length) {
      for (const [user_id, share] of proposePayers(parts, members)) payers.push({ line_id: line.id, user_id, share });
    } else if (!receipt.group_id) {
      payers.push({ line_id: line.id, user_id: user.id, share: 1 });
    }
  }
  if (payers.length) await sb.from("receipt_line_payers").insert(payers);

  await sb
    .from("receipts")
    .update({
      store_name: scan.store_name,
      purchased_at: /^\d{4}-\d{2}-\d{2}$/.test(scan.purchased_at ?? "") ? scan.purchased_at : undefined,
      total: scan.total,
    })
    .eq("id", receiptId);

  return NextResponse.json({ lines: inserted.length });
}