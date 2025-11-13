const fs = require('fs');
const path = require('path');
const { collectAllModules } = require('../src/shared/module-collector');

// main.jsが使う関数を全てブラウザ向けに変換
function buildEmbeddedCode() {
    const baseDir = path.join(__dirname, '..');

    let code = collectAllModules({
        includeParser: true,
        includeGenerator: false,
        mode: 'filesystem',
        baseDir: baseDir
    });

    // Web版用の関数を読み込んでmodule.exportsを削除
    const browserHtmlPath = path.join(baseDir, './src/core/generators/html-browser.js');
    const browserHtmlCode = fs.readFileSync(browserHtmlPath, 'utf8')
        .replace(/\/\/ Web版（ブラウザ環境）用のHTML生成関数[\s\S]*?(?=function)/g, '')
        .replace(/module\.exports = \{[\s\S]+?\};?/g, '');

    code += '\n\n// Web版用のHTML生成関数\n';
    code += browserHtmlCode;

    return code;
}

// webappテンプレートを読み込み
const template = fs.readFileSync('./tests/outputs/webapp-template.html', 'utf8');

// ${EMBEDDED_CODE}を埋め込みコードで置換
const embeddedCode = buildEmbeddedCode();
const finalWebapp = template.replace('${EMBEDDED_CODE}', embeddedCode);

// webapp.htmlを出力
fs.writeFileSync('./tests/outputs/webapp.html', finalWebapp, 'utf8');

console.log('webapp.html を生成しました');