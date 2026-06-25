import { exportPainelUsuariosSite } from "@/lib/painel-usuario-site";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

export const runtime = "nodejs";

function escapeCell(value: string) {
  return value.replaceAll('"', '""');
}

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, ["vis_situsu"]);

  if (!access.ok) {
    return access.response;
  }

  const { searchParams } = new URL(request.url);
  const rows = await exportPainelUsuariosSite(Object.fromEntries(searchParams.entries()));
  const headers = [
    "CPF",
    "Nome",
    "RG",
    "Nascimento",
    "Sexo",
    "E-mail",
    "Telefone",
    "Celular",
    "Endereco",
    "Numero",
    "CEP",
    "Bairro",
    "Regiao",
    "Complemento",
    "Status",
    "Data de Cadastro",
    "Ultimo Login",
    "Tipo de Usuario",
  ];
  const lines = [
    headers.join("\t"),
    ...rows.map((row) =>
      [
        row.cpf,
        row.nome,
        row.rg,
        row.nascimento,
        row.sexo,
        row.email,
        row.telefone,
        row.celular,
        row.endereco,
        row.numero,
        row.cep,
        row.bairro,
        row.regiao,
        row.complemento,
        row.status,
        row.cadastro,
        row.ultimoLogin,
        row.tipoUsuario,
      ]
        .map((cell) => `"${escapeCell(cell || "")}"`)
        .join("\t"),
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="usuarios-site.xls"`,
      "cache-control": "no-store",
    },
  });
}
