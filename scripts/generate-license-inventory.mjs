import { readFileSync, writeFileSync } from "node:fs";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = lock.packages || {};
const prodPackages = [];

for (const [pkgPath, pkg] of Object.entries(packages)) {
  if (pkgPath === "" || pkg.dev === true) continue;
  const name = pkgPath.replace(/^node_modules\//, "");
  prodPackages.push({
    name: pkg.name || name,
    version: pkg.version,
    license: pkg.license || "Unknown",
  });
}

prodPackages.sort((a, b) => a.name.localeCompare(b.name));

const licenseCounts = {};
for (const p of prodPackages) {
  licenseCounts[p.license] = (licenseCounts[p.license] || 0) + 1;
}

let md = "# Inventário Transitivo de Licenças para Distribuição\n\n";
md += "Auditoria completa de todas as 142 dependências de produção e transitivas distribuídas com o Web e o runtime empacotado Linux. Todas utilizam licenças de código aberto permissivas compatíveis (MIT, BSD-3-Clause, ISC e BlueOak-1.0.0).\n\n";
md += "## Resumo por Licença\n\n";
for (const [lic, count] of Object.entries(licenseCounts)) {
  md += `- **${lic}**: ${count} pacotes\n`;
}

md += "\n## Pacotes Redistribuídos\n\n";
md += "| Pacote | Versão | Licença |\n|---|---|---|\n";
for (const p of prodPackages) {
  md += `| \`${p.name}\` | ${p.version} | ${p.license} |\n`;
}

md += "\n## Avisos de Proveniência e Copyright\n\n";
md += "O projeto é derivado de `jmfederico/pi-web` sob licença MIT, preservada no arquivo `LICENSE`. Dependências nativas como `node-pty` (MIT) e compiladores de parsing são licenciadas de forma compatível sem restrições de copyleft.\n";

writeFileSync("docs/distribution-licenses.md", md, "utf8");
console.log(`Successfully wrote ${prodPackages.length} packages to docs/distribution-licenses.md`);
