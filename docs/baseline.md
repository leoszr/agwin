# Baseline funcional do PI WEB

Data da verificação: 2026-09-13

## Origem

- Repositório: `https://github.com/jmfederico/pi-web`
- Revisão: `46579c049a305b6a146d1028e539ca6d071fbfb4`
- Versão: `@jmfederico/pi-web@1.202609.0`
- Relação com a pesquisa: é exatamente a revisão pesquisada. O código importado não tem diferenças materiais; `package.json` acrescenta apenas `allowScripts["node-pty@1.1.0"] = true`, necessário para o build PTY com npm 12.
- Licença: MIT. O aviso original foi preservado em [`LICENSE`](../LICENSE) e a derivação está registrada em [`docs/provenance.md`](provenance.md).

## Evidência executada

A verificação oficial passou no runtime suportado:

```sh
mise exec node@22.19.0 -- npm run verify
```

Resultado: 381 arquivos de teste passaram; 3914 testes passaram e 2 foram ignorados pela própria suíte. `typecheck`, `lint` e `knip` também passaram.

Um probe isolado iniciou `sessiond` e Web/API em processos separados, criou uma Session real no Workspace `/home/leo/Projects/agwin`, consultou seu status, reiniciou somente Web/API e consultou a mesma Session novamente. O ID `01a09baf-fbce-750c-b044-0566394bba90`, modelo e estado permaneceram iguais. O daemon ficou ativo durante todo o reinício.

Os fluxos maduros foram cobertos pela suíte importada e por checks direcionados:

- Files: `src/server/app.workspaceFiles.test.ts` e `pi-web-plugins/files/FilesRuntime.test.ts`.
- Diff/Git: `pi-web-plugins/git/gitRoute.test.ts` e `pi-web-plugins/git/unifiedDiff.test.ts`.
- Terminal: `pi-web-plugins/terminal/server/terminalService.test.ts`; 19 testes passaram usando o módulo PTY nativo.
- Session: o probe real acima complementa a suíte de lifecycle em `src/server/sessions/`.

## Distinção entre base e mudanças

Comportamento preexistente: Session possuída pelo `sessiond`, reinício independente de Web/API, Files, Diff/Git e Terminal server-side.

Mudanças deste ticket: importação da base, mescla das instruções locais em `AGENTS.md` e documentação de proveniência/baseline. Nenhum comportamento de produção foi alterado.

## Ambiente

A revisão exige Node.js `>=22.19.0` e foi validada com Node.js 22.19.0/npm 11.12.1. Node.js 26.8.1/npm 12.0.2 não foi usado como gate: o Node 26 expõe `localStorage` global sem arquivo configurado e quebra o ambiente happy-dom desta revisão.
