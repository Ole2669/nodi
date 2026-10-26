import type { CoverInfo } from "./covers.js";

export function generateHaYaml(
  covers: CoverInfo[],
  baseUrl: string,
  opts: { bridgeToken?: string } = {},
): string {
  const base = baseUrl.replace(/\/$/, "");
  const ready = covers.filter((c) => c.ready);
  const incomplete = covers.filter((c) => !c.ready);
  const token = opts.bridgeToken;

  const lines: string[] = [
    "# nodi cover bridge",
    `# base: ${base}`,
    "",
  ];
  if (token) {
    lines.push("# includes Authorization from NODI_BRIDGE_TOKEN", "");
  }

  if (incomplete.length > 0) {
    lines.push("# incomplete (need open+close):");
    for (const c of incomplete) {
      lines.push(
        `#   ${c.id} (${c.name}) - ${c.actions.join(",") || "none"}`,
      );
    }
    lines.push("");
  }

  if (ready.length === 0) {
    lines.push("# no ready covers");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("rest_command:");
  for (const c of ready) {
    for (const action of c.actions) {
      lines.push(`  ${restKey(c.id, action)}:`);
      lines.push(
        `    url: "${base}/api/covers/${encodeURIComponent(c.id)}/${action}"`,
      );
      lines.push(`    method: POST`);
      if (token) {
        lines.push(`    headers:`);
        lines.push(`      Authorization: Bearer ${token}`);
      }
    }
  }

  lines.push("");
  lines.push("template:");
  lines.push("  - cover:");

  for (const c of ready) {
    const uid = entityId(c.id);
    lines.push(`      - name: ${yamlString(c.name)}`);
    lines.push(`        unique_id: ${uid}`);
    lines.push(`        device_class: shutter`);

    lines.push(`        open_cover:`);
    lines.push(`          - action: rest_command.${restKey(c.id, "open")}`);
    lines.push(`        close_cover:`);
    lines.push(`          - action: rest_command.${restKey(c.id, "close")}`);
    if (c.actions.includes("stop")) {
      lines.push(`        stop_cover:`);
      lines.push(`          - action: rest_command.${restKey(c.id, "stop")}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function entityId(shutterId: string): string {
  const safe = shutterId
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_|_$/g, "");
  return `nodi_${safe || "cover"}`;
}

export function restKey(shutterId: string, action: string): string {
  return `${entityId(shutterId)}_${action}`;
}

function yamlString(value: string): string {
  if (/^[\w äöüÄÖÜß\-]+$/u.test(value)) return `"${value}"`;
  return JSON.stringify(value);
}
