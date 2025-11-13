const fs = require('fs');
const path = require('path');
const { collectAllModules } = require('../src/shared/module-collector');

// main.jsが使う関数を全てブラウザ向けに変換
function buildEmbeddedCode() {
    const baseDir = path.join(__dirname, '..');

    return collectAllModules({
        includeParser: true,
        includeGenerator: true,
        mode: 'filesystem',
        baseDir: baseDir
    });
}

// webappテンプレートを読み込み
const template = fs.readFileSync('./tests/outputs/webapp-template.html', 'utf8');

// ${EMBEDDED_CODE}を埋め込みコードで置換
const embeddedCode = buildEmbeddedCode();
const finalWebapp = template.replace('${EMBEDDED_CODE}', embeddedCode);

// webapp.htmlを出力
fs.writeFileSync('./tests/outputs/webapp.html', finalWebapp, 'utf8');

console.log('webapp.html を生成しました');