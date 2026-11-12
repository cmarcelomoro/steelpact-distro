const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const DISTRO_DIR = 'E:/mod/steelpact-distro';
const DISTRO_JSON_PATH = path.join(DISTRO_DIR, 'distribution.json');
const BASE_URL = 'https://cmarcelomoro.github.io/steelpact-distro/';

function getFileMD5(filePath) {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(data).digest('hex');
}

function scanFolder(relativeFolder, targetType = 'File') {
    const fullFolderPath = path.join(DISTRO_DIR, relativeFolder);
    if (!fs.existsSync(fullFolderPath)) return [];

    const files = fs.readdirSync(fullFolderPath, { recursive: true });
    const modules = [];

    for (const f of files) {
        const fullPath = path.join(fullFolderPath, f);
        if (!fs.statSync(fullPath).isFile()) continue;

        const relPath = path.join(relativeFolder, f).replace(/\\/g, '/');
        const filename = path.basename(fullPath);
        const size = fs.statSync(fullPath).size;
        const md5 = getFileMD5(fullPath);

        modules.push({
            id: relPath.replace(/\//g, '-'),
            name: filename,
            type: targetType,
            required: { value: true },
            artifact: {
                size: size,
                MD5: md5,
                url: BASE_URL + encodeURI(relPath),
                path: relPath
            }
        });
    }

    return modules;
}

function updateDistribution() {
    console.log('🔄 Atualizando distribution.json do SteelPact...');

    let raw = fs.readFileSync(DISTRO_JSON_PATH, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const distro = JSON.parse(raw);
    const server = distro.servers[0];

    // Preservar Forge (ForgeHosted com subModules)
    const forgeModule = server.modules.find(m => m.id.startsWith('net.minecraftforge:forge'));
    
    // Preservar Releases externas (ex: arquivos >100MB do GitHub Releases)
    const releaseModules = server.modules.filter(m => m.artifact && m.artifact.url.includes('/releases/download/'));

    // Escanear pastas de conteúdo local
    const mods = scanFolder('mods', 'File');
    const flan = scanFolder('Flan', 'File');
    const config = scanFolder('config', 'File');

    // Combinar módulos
    const newModules = [];
    if (forgeModule) newModules.push(forgeModule);
    for (const rel of releaseModules) newModules.push(rel);

    // Adicionar escaneados (sem duplicatas)
    const allScanned = [...mods, ...flan, ...config];
    for (const item of allScanned) {
        if (!newModules.some(m => m.artifact && m.artifact.path === item.artifact.path)) {
            newModules.push(item);
        }
    }

    server.modules = newModules;

    fs.writeFileSync(DISTRO_JSON_PATH, JSON.stringify(distro, null, 2), 'utf8');
    console.log(`✅ Sucesso! Total de módulos na distribuição: ${server.modules.length}`);
    console.log('📝 Agora basta commitar e dar git push em steelpact-distro:');
    console.log('   cd E:\\mod\\steelpact-distro');
    console.log('   git add .');
    console.log('   git commit -m "update: novos mods/arquivos"');
    console.log('   git push origin main');
}

updateDistribution();
