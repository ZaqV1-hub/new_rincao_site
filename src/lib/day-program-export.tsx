import path from "node:path";
import React from "react";
import { Document, Font, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import JSZip from "jszip";
import sharp, { type OverlayOptions } from "sharp";
import type { DayProgram, DayProgramGroup } from "@/lib/day-program";

type ExportBlock = { text: string; heading?: boolean; cells?: string[]; tableHeader?: boolean; total?: boolean };
type ExportDocument = { filename: string; title: string; subtitle: string; blocks: ExportBlock[] };
const fontFile = path.join(process.cwd(), "public", "fonts", "rubik-400.ttf");
const boldFontFile = path.join(process.cwd(), "public", "fonts", "rubik-700.ttf");
const MAX_PAGES = 100;
const PAGE_WIDTH = 1190;
const PAGE_HEIGHT = 1684;
const MARGIN = 72;
Font.register({ family: "Day Program Rubik", fonts: [{ src: fontFile }, { src: boldFontFile, fontWeight: 700 }] });

function display(value: string | number | null) { return value === null || String(value).trim() === "" ? "a preencher" : String(value); }
function field(label: string, value: string | number | null): ExportBlock { return { text: `${label}: ${display(value)}` }; }
function total(groups: DayProgramGroup[], key: "plannedPeople" | "buses" | "vans", extra = 0) {
  const known = groups.reduce((sum, group) => sum + (group[key] ?? 0), extra);
  const unknown = groups.filter((group) => group[key] === null).length;
  return `${known}${unknown ? ` + ${unknown} grupo(s) a preencher` : ""}`;
}

// Both formats consume these copied strings; rendering never rereads mutable operational data.
export function buildDayProgramExportDocuments(program: DayProgram): ExportDocument[] {
  if (program.version === null) throw new Error("A programação deve estar criada antes da exportação.");
  if (program.carriers.some((carrier) => !Number.isSafeInteger(carrier.id) || carrier.id < 1) || new Set(program.carriers.map((carrier) => carrier.id)).size !== program.carriers.length) {
    throw new Error("Transportador com identificador inválido.");
  }
  const subtitle = `${program.date.split("-").reverse().join("/")} | Revisão ${program.version} | ${program.park === "rincao" ? "Rincão" : "Estância"}`;
  const carrierById = new Map(program.carriers.map((carrier) => [carrier.id, carrier]));
  const row = (cells: string[], extra: Partial<ExportBlock> = {}): ExportBlock => ({ text: cells.join(" | "), cells, ...extra });
  const blocks: ExportBlock[] = [row(["Representante", "Cliente", "Contato", "Público", "Veículos", "Transportador / embarque", "Observações"], { tableHeader: true })];
  for (const group of program.groups) {
    const carrier = group.carrierId === null ? undefined : carrierById.get(group.carrierId);
    const transport = group.transportMode === "client" ? "Transporte do cliente" : group.transportMode === "carrier" ? display(carrier?.name ?? null) : "a preencher";
    const extras = group.vehicles.filter(vehicle => vehicle.isExtra).map(vehicle => `${vehicle.type === "bus" ? "Ônibus" : "Van"} ${vehicle.ordinal} extra: ${display(vehicle.transportName)}`);
    blocks.push(row([display(group.representative), group.clientName,
      `${display(group.contact)}\n${display(group.phone)}`,
      display(group.plannedPeople), `${display(group.buses)} ônibus\n${display(group.vans)} vans${group.extraBuses + group.extraVans ? `\n+ ${group.extraBuses + group.extraVans} extras` : ""}`,
      `${transport}\nEmbarque: ${display(group.boardingTime)}${group.transportMode === "carrier" ? `\n${display(group.carrierContact)} · ${display(group.carrierPhone)}` : ""}`,
      [group.observations, group.foodNotes ? `Cozinha: ${group.foodNotes}` : null, ...extras,
        group.transportMode === "unset" || (group.transportMode === "carrier" && !carrier) ? "Sem ficha: transportador a preencher." : null].filter(Boolean).join("\n") || "—"]));
  }
  blocks.push(row(["—", "Day use", "—", String(program.dayUseSold), "—", "—", "Ingressos vendidos para a data"]));
  blocks.push(row(["Resumo do dia", `${program.groups.length} grupo(s) + day use`, `${total(program.groups, "plannedPeople")} em grupos + ${program.dayUseSold} day use`, total(program.groups, "plannedPeople", program.dayUseSold),
    `${total(program.groups, "buses", program.groups.reduce((sum, group) => sum + group.extraBuses, 0))} ônibus\n${total(program.groups, "vans", program.groups.reduce((sum, group) => sum + group.extraVans, 0))} vans`, "", ""], { total: true }));
  const hiring = program.hiringItems.filter((item) => item.value?.trim());
  if (hiring.length) blocks.push({ text: "Contratações", heading: true }, ...hiring.map((item) => field(item.name, item.value)));
  const weather = program.weather;
  blocks.push({ text: "Previsão do tempo", heading: true }, { text: weather.status === "available" ? weather.summary : "Previsão indisponível." });
  if (weather.stale) blocks.push({ text: "Previsão desatualizada" });
  if (weather.reason) blocks.push({ text: weather.reason });
  if (weather.status === "available") {
    const time = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
    if (weather.forecastAt) blocks.push(field("Previsão para (horário de Brasília)", time(weather.forecastAt)));
    if (weather.queriedAt) blocks.push(field("Consultada em (horário de Brasília)", time(weather.queriedAt)));
    if (weather.source) blocks.push(field("Fonte", `${weather.source}${weather.sourceUrl ? ` · ${weather.sourceUrl}` : ""}`));
    if (weather.license) blocks.push(field("Licença", `${weather.license}${weather.licenseUrl ? ` · ${weather.licenseUrl}` : ""}`));
  }
  blocks.push({ text: "Observações gerais", heading: true }, { text: program.observations?.trim() || "Nenhuma observação informada." });
  const documents: ExportDocument[] = [{ filename: "programacao", title: "Programação do dia", subtitle, blocks }];
  for (const carrier of program.carriers) {
    const stops = program.groups.filter((group) => group.transportMode === "carrier" && group.carrierId === carrier.id);
    if (!stops.length) continue;
    documents.push({ filename: `transportador-${carrier.id}`, title: `Ficha do transportador - ${carrier.name}`, subtitle,
      blocks: stops.flatMap((stop, index): ExportBlock[] => [{ text: `Parada ${index + 1} - ${stop.clientName}`, heading: true },
          field("Ônibus", stop.buses), field("Vans", stop.vans), field("Embarque", stop.boardingTime),
          field("Endereço", stop.address), field("Contato da escola", stop.contact), field("Telefone da escola", stop.phone),
          field("Contato do transportador", stop.carrierContact), field("Telefone do transportador", stop.carrierPhone)]) });
  }
  return documents;
}

function escapeMarkup(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Small paragraphs can flow between pages, including a single exceptionally long observation.
function paragraphs(text: string): string[] {
  const result: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const characters = Array.from(line);
    for (let offset = 0; offset < characters.length;) {
      let end = Math.min(offset + 240, characters.length);
      if (end < characters.length) {
        const space = characters.slice(offset, end).lastIndexOf(" ");
        if (space > 120) end = offset + space + 1;
      }
      result.push(characters.slice(offset, end).join("")); offset = end;
    }
  }
  return result;
}

const columnWidths = [0.12, 0.19, 0.16, 0.08, 0.10, 0.17, 0.18];
function expandedBlocks(document: ExportDocument): ExportBlock[] {
  return document.blocks.flatMap((block) => {
    if (!block.cells) return paragraphs(block.text).map((text) => ({ ...block, text }));
    // Split very long cells into continuation rows; never truncate school names or notes.
    const columns = block.cells.map(cell => cell.match(/[\s\S]{1,120}/gu) ?? [""]);
    return Array.from({ length: Math.max(...columns.map(column => column.length)) }, (_, index) => {
      const cells = columns.map(column => column[index] ?? "");
      return { ...block, cells, text: cells.join(" | ") };
    });
  });
}

async function pngText(text: string, size: number, bold = false, width = PAGE_WIDTH - MARGIN * 2) {
  return sharp({ text: { text: `<span foreground="#123b63">${escapeMarkup(text)}</span>`, font: `Rubik ${bold ? "Bold " : ""}${size}`,
    fontfile: bold ? boldFontFile : fontFile, width, rgba: true, wrap: "word-char" } }).png().toBuffer({ resolveWithObject: true });
}

async function appendPngs(zip: JSZip, document: ExportDocument, remainingPages: number): Promise<number> {
  let page = 1;
  let y = MARGIN;
  let layers: OverlayOptions[] = [];
  let tableHeading: { layers: OverlayOptions[]; height: number } | null = null;
  async function header() {
    const title = await pngText(document.title, 32, true);
    const subtitle = await pngText(document.subtitle, 20);
    layers = [{ input: title.data, left: MARGIN, top: MARGIN }, { input: subtitle.data, left: MARGIN, top: MARGIN + title.info.height + 16 }];
    y = MARGIN + title.info.height + subtitle.info.height + 52;
    if (y > PAGE_HEIGHT / 2) throw new Error("Título excede o limite da exportação.");
  }
  async function flush() {
    if (page > remainingPages) throw new Error(`A exportação excede o limite de ${MAX_PAGES} páginas.`);
    const footer = await pngText(`Página ${page} | ${document.subtitle}`, 16);
    layers.push({ input: footer.data, left: MARGIN, top: PAGE_HEIGHT - MARGIN });
    const bytes = await sharp({ create: { width: PAGE_WIDTH, height: PAGE_HEIGHT, channels: 3, background: "#ffffff" } }).composite(layers).png().toBuffer();
    zip.file(`${document.filename}-${String(page).padStart(3, "0")}.png`, bytes);
    page++;
  }
  await header();
  const blocks = expandedBlocks(document);
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (block.cells) {
      const width = PAGE_WIDTH - MARGIN * 2;
      const renderedCells = await Promise.all(block.cells.map((cell, column) => cell.trim() ? pngText(cell, 17, block.tableHeader || block.total, Math.floor(width * columnWidths[column]) - 16) : sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } }).png().toBuffer({ resolveWithObject: true })));
      const height = Math.max(...renderedCells.map(cell => cell.info.height)) + 20;
      if (y + height > PAGE_HEIGHT - MARGIN - 50) {
        await flush(); await header();
        if (tableHeading && !block.tableHeader) {
          layers.push(...tableHeading.layers.map(layer => ({ ...layer, top: y + (layer.top ?? 0) })));
          y += tableHeading.height;
        }
      }
      if (y + height > PAGE_HEIGHT - MARGIN - 50) throw new Error("Linha excede o limite da página.");
      const startLayer = layers.length;
      const background = await sharp({ create: { width, height, channels: 3, background: block.tableHeader || block.total ? "#eaf2fb" : "#ffffff" } }).png().toBuffer();
      layers.push({ input: background, left: MARGIN, top: y });
      let x = MARGIN;
      for (let column = 0; column < renderedCells.length; column++) {
        layers.push({ input: renderedCells[column].data, left: x + 8, top: y + 10 });
        x += Math.floor(width * columnWidths[column]);
      }
      const line = await sharp({ create: { width, height: 1, channels: 3, background: "#d4dfeb" } }).png().toBuffer();
      layers.push({ input: line, left: MARGIN, top: y + height - 1 });
      if (block.tableHeader) tableHeading = { height, layers: layers.slice(startLayer).map(layer => ({ ...layer, top: (layer.top ?? 0) - y })) };
      y += height;
      continue;
    }
    const rendered = await pngText(block.text, block.heading ? 25 : 20, block.heading);
    const before = block.heading ? 20 : 0;
    const after = block.heading ? 14 : 10;
    // Leave room for the next row so a heading never ends a PNG page alone.
    const keepNext = block.heading && index + 1 < blocks.length ? (await pngText(blocks[index + 1].text, blocks[index + 1].heading ? 25 : 20, blocks[index + 1].heading)).info.height + 30 : 0;
    if (y + before + rendered.info.height + after + keepNext > PAGE_HEIGHT - MARGIN - 50) { await flush(); await header(); }
    if (y + before + rendered.info.height > PAGE_HEIGHT - MARGIN - 50) throw new Error("Texto excede o limite da página.");
    layers.push({ input: rendered.data, left: MARGIN, top: y + before });
    y += before + rendered.info.height + after;
  }
  await flush();
  return page - 1;
}

async function renderPdf(document: ExportDocument, remainingPages: number) {
  let pageCount = 0;
  const buffer = await renderToBuffer(<Document title={document.title} language="pt-BR">
    <Page size="A4" style={{ padding: 36, paddingBottom: 55, fontFamily: "Day Program Rubik", fontSize: 10, color: "#123b63" }}>
      <View fixed style={{ marginBottom: 18 }}>
        <Text hyphenationCallback={(word) => word.length > 40 ? Array.from(word) : [word]} style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{document.title}</Text>
        <Text>{document.subtitle}</Text>
      </View>
      {expandedBlocks(document).map((block, index) => block.cells ? <View key={index} wrap={false} style={{ flexDirection: "row", backgroundColor: block.tableHeader || block.total ? "#eaf2fb" : "#ffffff", borderBottomWidth: 0.5, borderBottomColor: "#d4dfeb", minHeight: 20 }}>
        {block.cells.map((cell, column) => <Text key={column} hyphenationCallback={(word) => word.length > 12 ? Array.from(word) : [word]} style={{ width: `${columnWidths[column] * 100}%`, padding: 4, fontSize: 8, lineHeight: 1.35, fontWeight: block.tableHeader || block.total ? 700 : 400 }}>{cell}</Text>)}
      </View> : <Text key={index} minPresenceAhead={block.heading ? 24 : 0}
        hyphenationCallback={(word) => word.length > 40 ? Array.from(word) : [word]}
        style={{ fontSize: block.heading ? 12.5 : 10, fontWeight: block.heading ? 700 : 400, marginTop: block.heading ? 10 : 0, marginBottom: 6, lineHeight: 1.4 }}>
        {block.text}
      </Text>)}
      <Text fixed style={{ position: "absolute", bottom: 27, left: 36, right: 36, fontSize: 8 }} render={({ pageNumber, totalPages }) => {
        pageCount = Math.max(pageCount, totalPages || pageNumber);
        if (pageCount > remainingPages) throw new Error(`A exportação excede o limite de ${MAX_PAGES} páginas.`);
        return `Página ${pageNumber} de ${totalPages} | ${document.subtitle}`;
      }} />
    </Page>
  </Document>);
  return { buffer, pageCount };
}

export async function renderDayProgramBundle(program: DayProgram): Promise<Buffer> {
  const documents = buildDayProgramExportDocuments(program);
  const characterCount = documents.reduce((sum, document) => sum + document.title.length + document.subtitle.length + document.blocks.reduce((length, block) => length + block.text.length, 0), 0);
  if (characterCount > 250000 || documents.length > MAX_PAGES || documents.some((document) => document.title.length > 1000)) throw new Error("Dados excedem o limite da exportação.");
  const zip = new JSZip();
  let pngPages = 0;
  let pdfPages = 0;
  for (const document of documents) {
    pngPages += await appendPngs(zip, document, MAX_PAGES - pngPages);
    const pdf = await renderPdf(document, MAX_PAGES - pdfPages);
    pdfPages += pdf.pageCount;
    zip.file(`${document.filename}.pdf`, pdf.buffer);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
