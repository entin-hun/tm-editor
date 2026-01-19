const fs = require('fs');
const path = require('path');

function findFirstExisting(paths) {
  for (const candidate of paths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseTypeDefinitions(content) {
  const interfacePattern = /export\s+interface\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{([\s\S]*?)\}/g;
  const interfaces = [];

  let match;
  while ((match = interfacePattern.exec(content)) !== null) {
    const [, name, extendsFrom, body] = match;
    const fields = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//') && !line.startsWith('/*'))
      .map((line) => {
        const fieldMatch = line.match(/(\w+)(\?)?:\s*([^;]+);?/);
        if (fieldMatch) {
          const [, fieldName, optional, fieldType] = fieldMatch;
          return {
            name: fieldName,
            type: fieldType.trim(),
            optional: !!optional,
          };
        }
        return null;
      })
      .filter(Boolean);

    interfaces.push({
      name,
      extends: extendsFrom || null,
      fields,
    });
  }

  return { interfaces };
}

function getDataTypeFromFieldType(fieldType) {
  const normalized = fieldType.replace(/\s+/g, ' ').trim();
  const parts = normalized.split('|').map((part) => part.trim());
  for (const part of parts) {
    const noArray = part.replace(/\[\]$/, '').trim();
    if (/^[A-Z]\w+$/.test(noArray) && noArray.endsWith('Instance')) {
      return noArray;
    }
  }
  return null;
}

function mergeDescriptions(descriptions, interfaces) {
  const merged = { ...descriptions };
  const addedFields = [];

  for (const iface of interfaces) {
    const existing = descriptions[iface.name];
    const fields = {};

    for (const field of iface.fields) {
      const existingField = existing?.fields?.[field.name];
      const mergedField = {
        label: field.name,
        description: 'Auto-generated field from types',
        ...(existingField || {}),
      };

      if (!existingField) {
        addedFields.push({
          type: iface.name,
          field: field.name,
          fieldType: field.type,
        });
      }

      if (!mergedField.dataType) {
        const inferred = getDataTypeFromFieldType(field.type);
        if (inferred) mergedField.dataType = inferred;
      }

      fields[field.name] = mergedField;
    }

    const extendsName = existing?.extends || iface.extends;
    merged[iface.name] = {
      name: existing?.name || iface.name,
      description: existing?.description || 'Auto-generated from types',
      fields,
      ...(extendsName ? { extends: extendsName } : {}),
    };
  }

  return { merged, addedFields };
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const typesPath = findFirstExisting([
    path.resolve(projectRoot, '..', 'tm-types', 'src', 'index.d.ts'),
    path.resolve(projectRoot, 'node_modules', '@trace.market', 'types', 'src', 'index.d.ts'),
  ]);

  const changelogPath = findFirstExisting([
    path.resolve(projectRoot, '..', 'tm-types', 'CHANGELOG.md'),
    path.resolve(projectRoot, 'node_modules', '@trace.market', 'types', 'CHANGELOG.md'),
  ]);

  const descriptionsPath = findFirstExisting([
    path.resolve(projectRoot, '..', 'tm-types', 'src', 'descriptions.json'),
    path.resolve(projectRoot, 'node_modules', '@trace.market', 'types', 'src', 'descriptions.json'),
  ]);

  if (!typesPath) {
    throw new Error('Unable to locate index.d.ts from @trace.market/types.');
  }
  if (!descriptionsPath) {
    throw new Error('Unable to locate descriptions.json from @trace.market/types.');
  }

  const typeSource = readText(typesPath);
  const descriptions = readJson(descriptionsPath);
  const { interfaces } = parseTypeDefinitions(typeSource);
  const { merged, addedFields } = mergeDescriptions(descriptions, interfaces);

  const outputPath = path.resolve(projectRoot, 'public', 'merged-descriptions.json');
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));
  console.log(`Merged schema written to ${outputPath}`);

  const reportPath = path.resolve(projectRoot, 'public', 'types-merge-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ addedFields }, null, 2));
  console.log(`Types merge report written to ${reportPath}`);

  if (changelogPath) {
    const changelogOutput = path.resolve(projectRoot, 'public', 'types-changelog.md');
    fs.copyFileSync(changelogPath, changelogOutput);
    console.log(`Types changelog copied to ${changelogOutput}`);
  }
}

main();
