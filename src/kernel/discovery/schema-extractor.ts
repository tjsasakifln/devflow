/**
 * Schema Extractor — Database schema detection for ERD generation.
 *
 * Detects database schemas from ORM models, migration files, and SQL schemas.
 * Generates Mermaid ERD diagrams.
 */

import path from "node:path";
import { execSync } from "node:child_process";
import { safeReadFile, fileExists, isDirectory } from "../utils/fs.js";

export interface TableInfo {
  name: string;
  columns: Array<{ name: string; type: string; key: "PK" | "FK" | "none"; nullable: boolean }>;
  source: string;
}

export interface SchemaERD {
  tables: TableInfo[];
  relationships: Array<{ from: string; to: string; type: "1:1" | "1:N" | "N:M" }>;
  mermaidERD: string;
}

/**
 * Extract database schema from project files.
 * Returns null if no database schema is detected.
 */
export async function extractSchema(rootPath: string): Promise<SchemaERD | null> {
  const tables: TableInfo[] = [];

  // 1. Check for Prisma schema
  const prismaSchema = await extractPrismaSchema(rootPath);
  if (prismaSchema) tables.push(...prismaSchema.tables);

  // 2. Check for TypeORM entities
  const typeormEntities = await extractTypeORMEntities(rootPath);
  if (typeormEntities) tables.push(...typeormEntities.tables);

  // 3. Check for raw SQL migration files
  const sqlMigrations = await extractSQLMigrations(rootPath);
  if (sqlMigrations) tables.push(...sqlMigrations.tables);

  // 4. Check for Sequelize models
  const sequelizeModels = await extractSequelizeModels(rootPath);
  if (sequelizeModels) tables.push(...sequelizeModels.tables);

  if (tables.length === 0) return null;

  const relationships = detectRelationships(tables);
  const mermaidERD = buildMermaidERD(tables, relationships);

  return { tables, relationships, mermaidERD };
}

interface ExtractedSchema {
  tables: TableInfo[];
}

/**
 * Extract tables from Prisma schema file.
 */
async function extractPrismaSchema(rootPath: string): Promise<ExtractedSchema | null> {
  const prismaPaths = [
    "prisma/schema.prisma",
    "db/schema.prisma",
    "database/schema.prisma",
  ];

  for (const pp of prismaPaths) {
    const fullPath = path.join(rootPath, pp);
    if (await fileExists(fullPath)) {
      const content = await safeReadFile(fullPath);
      if (!content) continue;

      const tables: TableInfo[] = [];
      const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
      let match: RegExpExecArray | null;
      while ((match = modelRegex.exec(content)) !== null) {
        const tableName: string = match[1] ?? "";
        const body: string = match[2] ?? "";
        const columns: Array<{ name: string; type: string; key: "PK" | "FK" | "none"; nullable: boolean }> = [];

        for (const line of body.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;

          const colMatch = trimmed.match(/^(\w+)\s+(\w+[?]?)\s*(.*)/);
          if (colMatch) {
            const colName: string = colMatch[1] ?? "";
            let type: string = (colMatch[2] ?? "").replace("?", "");
            const isNullable = (colMatch[2] ?? "").endsWith("?");
            const attrs: string = colMatch[3] ?? "";

            let key: "PK" | "FK" | "none" = "none";
            if (attrs.includes("@id")) key = "PK";
            else if (attrs.includes("@relation")) key = "FK";

            if (type.endsWith("[]")) continue;

            columns.push({ name: colName, type, key, nullable: isNullable });
          }
        }

        if (columns.length > 0) {
          tables.push({ name: tableName, columns, source: pp });
        }
      }

      if (tables.length > 0) return { tables };
    }
  }

  return null;
}

/**
 * Extract tables from TypeORM entity files.
 */
async function extractTypeORMEntities(rootPath: string): Promise<ExtractedSchema | null> {
  const tables: TableInfo[] = [];

  try {
    const out = execSync(
      `find . -name "*.entity.ts" -o -name "*.entity.js" 2>/dev/null | head -20`,
      { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
    );

    for (const file of out.trim().split("\n").filter(Boolean)) {
      const content = await safeReadFile(path.join(rootPath, file));
      if (!content) continue;

      const classMatch = content.match(/@Entity(?:\([^)]*\))?\s*\n?\s*export\s+class\s+(\w+)/);
      if (!classMatch || !classMatch[1]) continue;

      const tableName: string = classMatch[1];
      const columns: Array<{ name: string; type: string; key: "PK" | "FK" | "none"; nullable: boolean }> = [];

      const colRegex = /@(Column|PrimaryGeneratedColumn|PrimaryColumn|ManyToOne|OneToMany|JoinColumn|ManyToMany)(?:\([^)]*\))?\s*\n?\s*(\w+)/g;
      let colMatch: RegExpExecArray | null;
      while ((colMatch = colRegex.exec(content)) !== null) {
        const decorator: string = colMatch[1] ?? "";
        const colName: string = colMatch[2] ?? "";

        let key: "PK" | "FK" | "none" = "none";
        if (decorator === "PrimaryGeneratedColumn" || decorator === "PrimaryColumn") key = "PK";
        else if (decorator === "ManyToOne" || decorator === "JoinColumn") key = "FK";
        else if (colName.toLowerCase().includes("id") && decorator === "Column") key = "FK";

        columns.push({ name: colName, type: "unknown", key, nullable: true });
      }

      if (columns.length > 0) {
        tables.push({ name: tableName, columns, source: file });
      }
    }
  } catch { /* ignore */ }

  return tables.length > 0 ? { tables } : null;
}

/**
 * Extract tables from raw SQL migration files.
 */
async function extractSQLMigrations(rootPath: string): Promise<ExtractedSchema | null> {
  const migrationDirs = [
    "migrations/",
    "db/migrations/",
    "database/migrations/",
    "prisma/migrations/",
  ];

  const tables: TableInfo[] = [];

  for (const dir of migrationDirs) {
    const fullDir = path.join(rootPath, dir);
    if (!(await isDirectory(fullDir))) continue;

    try {
      const out = execSync(
        `find ${dir}/ -name "*.sql" -type f 2>/dev/null | sort | head -10`,
        { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
      );

      for (const file of out.trim().split("\n").filter(Boolean)) {
        const content = await safeReadFile(path.join(rootPath, file));
        if (!content) continue;

        const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|'|)(\w+)(?:`|"|'|)\s*\(([^;]*?)\)/gis;
        let match: RegExpExecArray | null;
        while ((match = createRegex.exec(content)) !== null) {
          const tableName: string = match[1] ?? "";
          const body: string = match[2] ?? "";
          const columns: Array<{ name: string; type: string; key: "PK" | "FK" | "none"; nullable: boolean }> = [];

          const colLines = splitSQLColumns(body);
          for (const rawLine of colLines) {
            const trimmed = rawLine.trim();
            if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("//")) continue;
            if (/^(PRIMARY|FOREIGN|INDEX|UNIQUE|CONSTRAINT|KEY)\s/i.test(trimmed)) continue;

            const colMatch = trimmed.match(/^(?:`|"|'|)(\w+)(?:`|"|'|)\s+(\w+(?:\s*\([^)]*\))?)\s*(.*)/i);
            if (colMatch) {
              const colName: string = colMatch[1] ?? "";
              const colType: string = colMatch[2] ?? "";
              const rest = (colMatch[3] ?? "").toUpperCase();

              let key: "PK" | "FK" | "none" = "none";
              if (rest.includes("PRIMARY KEY")) key = "PK";
              if (rest.includes("REFERENCES")) key = "FK";
              const nullable = !rest.includes("NOT NULL");

              columns.push({ name: colName, type: colType, key, nullable });
            }
          }

          if (columns.length > 0) {
            tables.push({ name: tableName, columns, source: file });
          }
        }
      }
    } catch { /* ignore */ }
  }

  return tables.length > 0 ? { tables } : null;
}

/**
 * Extract tables from Sequelize model definitions.
 */
async function extractSequelizeModels(rootPath: string): Promise<ExtractedSchema | null> {
  const modelDirs = [
    "src/models/",
    "models/",
    "db/models/",
  ];

  const tables: TableInfo[] = [];

  for (const dir of modelDirs) {
    const fullDir = path.join(rootPath, dir);
    if (!(await isDirectory(fullDir))) continue;

    try {
      const out = execSync(
        `find ${dir}/ -name "*.ts" -o -name "*.js" 2>/dev/null | head -20`,
        { cwd: rootPath, encoding: "utf-8", timeout: 10000 },
      );

      for (const file of out.trim().split("\n").filter(Boolean)) {
        const content = await safeReadFile(path.join(rootPath, file));
        if (!content) continue;

        if (content.includes("sequelize.define") || content.includes("extends Model")) {
          const nameMatch = content.match(/\.define\s*\(\s*['"](\w+)['"]/);
          if (!nameMatch) {
            const clsMatch = content.match(/class\s+(\w+)\s+extends\s+Model/);
            if (clsMatch && clsMatch[1]) {
              const tableName: string = clsMatch[1];
              const columns: Array<{ name: string; type: string; key: "PK" | "FK" | "none"; nullable: boolean }> = [];

              const fieldRegex = /(\w+)\s*:\s*{\s*(?:type|dataType)\s*:/g;
              let fieldMatch: RegExpExecArray | null;
              while ((fieldMatch = fieldRegex.exec(content)) !== null) {
                const colName: string = fieldMatch[1] ?? "";
                let key: "PK" | "FK" | "none" = "none";
                if (colName === "id" || colName.endsWith("Id")) key = "PK";
                columns.push({ name: colName, type: "Model", key, nullable: true });
              }

              if (columns.length > 0) {
                tables.push({ name: tableName, columns, source: file });
              }
            }
            continue;
          }

          const tableName: string = nameMatch[1] ?? "";
          const columns: Array<{ name: string; type: string; key: "PK" | "FK" | "none"; nullable: boolean }> = [];

          const fieldRegex = /(\w+)\s*:\s*{\s*(?:type|dataType)\s*:/g;
          let fieldMatch: RegExpExecArray | null;
          while ((fieldMatch = fieldRegex.exec(content)) !== null) {
            const colName: string = fieldMatch[1] ?? "";
            let key: "PK" | "FK" | "none" = "none";
            if (colName === "id" || colName.endsWith("Id")) key = "PK";
            columns.push({ name: colName, type: "Model", key, nullable: true });
          }

          if (columns.length > 0) {
            tables.push({ name: tableName, columns, source: file });
          }
        }
      }
    } catch { /* ignore */ }
  }

  return tables.length > 0 ? { tables } : null;
}

/**
 * Detect relationships between tables based on FK naming conventions.
 */
function detectRelationships(tables: TableInfo[]): Array<{ from: string; to: string; type: "1:1" | "1:N" | "N:M" }> {
  const relationships: Array<{ from: string; to: string; type: "1:1" | "1:N" | "N:M" }> = [];

  for (const table of tables) {
    for (const col of table.columns) {
      if (col.key === "FK" || (col.name.endsWith("Id") && col.name !== "id")) {
        const refName = col.name.replace(/Id$/, "");
        const refTable = tables.find(
          (t) => t.name.toLowerCase() === refName.toLowerCase(),
        );
        if (refTable) {
          relationships.push({ from: refTable.name, to: table.name, type: "1:N" });
        }
      }
    }
  }

  return relationships;
}

/**
 * Generate Mermaid ERD diagram.
 */
function buildMermaidERD(
  tables: TableInfo[],
  relationships: Array<{ from: string; to: string; type: string }>,
): string {
  const lines: string[] = [];

  lines.push("erDiagram");
  for (const table of tables) {
    lines.push(`    ${table.name} {`);
    for (const col of table.columns) {
      const keyType = col.key === "PK" ? "PK" : col.key === "FK" ? "FK" : "";
      const nullable = col.nullable ? "nullable" : "";
      const annotations = [keyType, nullable].filter(Boolean).join(" ");
      lines.push(`        ${col.type} ${col.name} ${annotations}`.trimEnd());
    }
    lines.push("    }");
  }

  for (const rel of relationships) {
    const relSymbol = rel.type === "1:1" ? "||--||" : rel.type === "N:M" ? "}o--o{" : "||--o{";
    lines.push(`    ${rel.from} ${relSymbol} ${rel.to} : has`);
  }

  return lines.join("\n");
}

/**
 * Split SQL column definitions respecting parentheses nesting.
 */
function splitSQLColumns(body: string): string[] {
  const columns: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of body) {
    if (char === "(") { depth++; current += char; }
    else if (char === ")") { depth--; current += char; }
    else if (char === "," && depth === 0) {
      columns.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) columns.push(current);
  return columns;
}
