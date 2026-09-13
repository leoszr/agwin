import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export function analyzeCrap(filePath, coverageFinalPath = 'coverage/coverage-final.json') {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  if (!fs.existsSync(coverageFinalPath)) {
    throw new Error(`Coverage file not found: ${coverageFinalPath}. Run 'npm run test:coverage' first.`);
  }

  const coverageJson = JSON.parse(fs.readFileSync(coverageFinalPath, 'utf8'));
  const fileCoverage = coverageJson[fullPath] || Object.entries(coverageJson).find(([k]) => k.endsWith(filePath))?.[1];

  if (!fileCoverage) {
    throw new Error(`No coverage entry found for ${filePath} in ${coverageFinalPath}`);
  }

  const sourceContent = fs.readFileSync(fullPath, 'utf8');
  const sourceFile = ts.createSourceFile(fullPath, sourceContent, ts.ScriptTarget.Latest, true);

  function getCyclomaticComplexity(node) {
    let complexity = 1;
    function visit(n) {
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
          complexity++;
          break;
        case ts.SyntaxKind.BinaryExpression: {
          if (
            n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
            n.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
            n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
          ) {
            complexity++;
          }
          break;
        }
      }
      ts.forEachChild(n, visit);
    }
    ts.forEachChild(node, visit);
    return complexity;
  }

  const results = [];

  function inspect(node) {
    let name = null;
    if (ts.isFunctionDeclaration(node) && node.name) {
      name = node.name.text;
    } else if (ts.isMethodDeclaration(node) && node.name) {
      name = node.name.getText(sourceFile);
    }

    if (name) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const startLine = start.line + 1;
      const endLine = end.line + 1;
      const complexity = getCyclomaticComplexity(node);

      let totalStmts = 0;
      let coveredStmts = 0;
      for (const [id, sLoc] of Object.entries(fileCoverage.statementMap)) {
        if (sLoc.start.line >= startLine && sLoc.end.line <= endLine) {
          totalStmts++;
          if ((fileCoverage.s[id] || 0) > 0) {
            coveredStmts++;
          }
        }
      }

      const coverageRatio = totalStmts > 0 ? coveredStmts / totalStmts : 0;
      // CRAP(m) = comp^2 * (1 - cov)^3 + comp
      const crap = Math.round((Math.pow(complexity, 2) * Math.pow(1 - coverageRatio, 3) + complexity) * 10) / 10;

      results.push({
        name,
        line: startLine,
        complexity,
        statements: totalStmts,
        coveredStatements: coveredStmts,
        coveragePct: Math.round(coverageRatio * 1000) / 10,
        crap,
        status: crap > 30 ? 'CRAPPY' : 'OK'
      });
    }

    ts.forEachChild(node, inspect);
  }

  inspect(sourceFile);
  results.sort((a, b) => b.crap - a.crap);
  return results;
}

const target = process.argv[2] || 'src/client/src/api/parsers.ts';
try {
  const results = analyzeCrap(target);
  const crappyCount = results.filter(r => r.crap > 30).length;

  console.log(`\n=== CRAP Report: ${target} ===`);
  console.log(`Total de funções analisadas: ${results.length}`);
  console.log(`Funções com alto risco (CRAP > 30): ${crappyCount}\n`);

  console.log(
    'Função'.padEnd(32) +
    'Linha'.padEnd(8) +
    'Complexidade'.padEnd(14) +
    'Cobertura'.padEnd(12) +
    'CRAP'.padEnd(8) +
    'Status'
  );
  console.log('-'.repeat(82));

  for (const r of results.slice(0, 15)) {
    const name = r.name.length > 30 ? r.name.slice(0, 27) + '...' : r.name;
    console.log(
      name.padEnd(32) +
      String(r.line).padEnd(8) +
      String(r.complexity).padEnd(14) +
      (r.coveragePct + '%').padEnd(12) +
      String(r.crap).padEnd(8) +
      (r.status === 'CRAPPY' ? '\x1b[31mCRAPPY\x1b[0m' : '\x1b[32mOK\x1b[0m')
    );
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
