const fs = require('fs');

// main.jsが使う関数を全てブラウザ向けに変換
function buildEmbeddedCode() {
    let code = '\n';

    // 1. パーサー (parseMermaidNodes, parseMermaidConnections, parseMermaidStyles, parseMermaidClassDefs)
    const parserContent = fs.readFileSync('./src/core/parsers/mermaid.js', 'utf8');
    const parseMermaidNodesMatch = parserContent.match(/function parseMermaidNodes[\s\S]*?(?=\n\/\/ Parse Mermaid connections|function parse)/);
    const parseMermaidConnectionsMatch = parserContent.match(/function parseMermaidConnections[\s\S]*?(?=\n\/\/ Parse Mermaid style|function parse)/);
    const parseMermaidStylesMatch = parserContent.match(/function parseMermaidStyles[\s\S]*?(?=\n\/\/ Parse Mermaid class|function parse)/);
    const parseMermaidClassDefsMatch = parserContent.match(/function parseMermaidClassDefs[\s\S]*?(?=\nmodule\.exports)/);

    code += '// パーサー\n';
    if (parseMermaidNodesMatch) code += parseMermaidNodesMatch[0] + '\n\n';
    if (parseMermaidConnectionsMatch) code += parseMermaidConnectionsMatch[0] + '\n\n';
    if (parseMermaidStylesMatch) code += parseMermaidStylesMatch[0] + '\n\n';
    if (parseMermaidClassDefsMatch) code += parseMermaidClassDefsMatch[0] + '\n\n';

    // 2. バリデーター (validateTreeStructure)
    const validatorContent = fs.readFileSync('./src/core/validators/tree-validator.js', 'utf8');
    const validateTreeStructureMatch = validatorContent.match(/function validateTreeStructure[\s\S]*?(?=\nmodule\.exports)/);

    code += '// バリデーター\n';
    if (validateTreeStructureMatch) code += validateTreeStructureMatch[0] + '\n\n';

    // 2.5. createDashedNodesAndEdges (main.jsから)
    const mainContent = fs.readFileSync('./cli/main.js', 'utf8');
    const createDashedNodesAndEdgesMatch = mainContent.match(/function createDashedNodesAndEdges[\s\S]*?(?=\n\/\/ Main function)/);

    code += '// バックエッジ処理\n';
    if (createDashedNodesAndEdgesMatch) code += createDashedNodesAndEdgesMatch[0] + '\n\n';

    // 3. getter関数の中身を抽出するヘルパー関数
    function extractGetterContent(fileContent) {
        // function getFoo() { return `...`; } の形式から、`...`の部分だけを抽出
        // 1. module.exportsを削除
        let cleaned = fileContent.replace(/module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/g, '').trim();

        // 2. function定義行を削除 (function xxx() {)
        cleaned = cleaned.replace(/^function\s+\w+\s*\(\s*\)\s*\{/g, '').trim();

        // 3. 最後の } を削除
        if (cleaned.endsWith('}')) {
            cleaned = cleaned.substring(0, cleaned.length - 1).trim();
        }

        // 4. return ` と最後の `; を削除
        if (cleaned.startsWith('return `')) {
            cleaned = cleaned.substring('return `'.length);
        }
        if (cleaned.endsWith('`;')) {
            cleaned = cleaned.substring(0, cleaned.length - 2);
        } else if (cleaned.endsWith('`')) {
            cleaned = cleaned.substring(0, cleaned.length - 1);
        }

        return cleaned;
    }

    // 3. 各getter関数の内容を取得
    // getBaseTemplateは関数のまま保持（オブジェクトを返すため）
    const getBaseTemplateRaw = fs.readFileSync('./src/templates/base.js', 'utf8')
        .replace(/module\.exports = \{[^}]+\};?/g, '');

    code += '// テンプレート関数\n';
    code += getBaseTemplateRaw + '\n\n';

    const getLayoutUtils = extractGetterContent(fs.readFileSync('./src/shared/layout-utils.js', 'utf8'));
    const getSVGHelpers = extractGetterContent(fs.readFileSync('./src/shared/svg-helpers.js', 'utf8'));
    const getTreeStructureAnalyzer = extractGetterContent(fs.readFileSync('./src/shared/tree-structure.js', 'utf8'));
    const getVerticalLayout = extractGetterContent(fs.readFileSync('./src/core/layouts/vertical-layout.js', 'utf8'));
    const getConnectionConstants = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/constants.js', 'utf8'));
    const getConnectionUtils = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/utils.js', 'utf8'));
    const getCollectors = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/collectors.js', 'utf8'));
    const getDepthUtils = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/depth-utils.js', 'utf8'));
    const getCollisionUtils = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/collision-utils.js', 'utf8'));
    const getPathYAdjuster = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/path-y-adjuster.js', 'utf8'));
    const getPathGenerator = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/path-generator.js', 'utf8'));
    const getEdgeSpacingCalculator = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/edge-spacing-calculator.js', 'utf8'));
    const getConnectionLabels = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/labels.js', 'utf8'));
    const getVerticalSegmentCalculator = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/vertical-segment-calculator.js', 'utf8'));
    const getEdgeCrossingDetector = extractGetterContent(fs.readFileSync('./src/runtime/rendering/connections/edge-crossing-detector.js', 'utf8'));
    let getConnectionRendererRaw = fs.readFileSync('./src/runtime/rendering/connections/renderer.js', 'utf8');
    // renderer.jsのrequire文を削除してから抽出
    getConnectionRendererRaw = getConnectionRendererRaw
        .replace(/\s*const connectionLabels = require\('\.\/labels'\)\.getConnectionLabels\(\);\s*/g, '\n')
        .replace(/\s*const verticalSegmentCalculator = require\('\.\/vertical-segment-calculator'\)\.getVerticalSegmentCalculator\(\);\s*/g, '\n')
        .replace(/\s*const edgeCrossingDetector = require\('\.\/edge-crossing-detector'\)\.getEdgeCrossingDetector\(\);\s*/g, '\n')
        .replace(/return connectionLabels \+ verticalSegmentCalculator \+ edgeCrossingDetector \+ `/g, 'return `');
    const getConnectionRenderer = extractGetterContent(getConnectionRendererRaw);

    const getRedrawHelpers = extractGetterContent(fs.readFileSync('./src/runtime/rendering/redraw-helpers.js', 'utf8'));
    const getShadowManager = extractGetterContent(fs.readFileSync('./src/runtime/rendering/effects/shadow-manager.js', 'utf8'));
    const getCollapseManager = extractGetterContent(fs.readFileSync('./src/runtime/state/collapse-manager.js', 'utf8'));
    const getLayoutSwitcher = extractGetterContent(fs.readFileSync('./src/runtime/ui/layout-switcher.js', 'utf8'));
    const getViewportManager = extractGetterContent(fs.readFileSync('./src/runtime/ui/viewport-manager.js', 'utf8'));
    const getHighlightManager = extractGetterContent(fs.readFileSync('./src/runtime/state/highlight-manager.js', 'utf8'));
    const getPathHighlighter = extractGetterContent(fs.readFileSync('./src/runtime/state/path-highlighter.js', 'utf8'));
    const getEdgeHighlighter = extractGetterContent(fs.readFileSync('./src/runtime/state/edge-highlighter.js', 'utf8'));
    const getContextMenu = extractGetterContent(fs.readFileSync('./src/runtime/ui/context-menu.js', 'utf8'));
    const getRenderOrchestrator = extractGetterContent(fs.readFileSync('./src/runtime/core/render-orchestrator.js', 'utf8'));
    const getTypes = extractGetterContent(fs.readFileSync('./src/core/layout/types.js', 'utf8'));
    const getNodePlacer = extractGetterContent(fs.readFileSync('./src/core/layout/node-placer.js', 'utf8'));
    const getCollisionResolver = extractGetterContent(fs.readFileSync('./src/core/layout/collision-resolver.js', 'utf8'));
    const getEdgeRouter = extractGetterContent(fs.readFileSync('./src/core/layout/edge-router.js', 'utf8'));

    let getLayoutEngineRaw = fs.readFileSync('./src/core/layout/layout-engine.js', 'utf8');
    // layout-engine.jsのrequire文を削除してから抽出
    getLayoutEngineRaw = getLayoutEngineRaw
        .replace(/\s*const types = require\('\.\/types'\)\.getTypes\(\);\s*/g, '\n')
        .replace(/\s*const nodePlacer = require\('\.\/node-placer'\)\.getNodePlacer\(\);\s*/g, '\n')
        .replace(/\s*const collisionResolver = require\('\.\/collision-resolver'\)\.getCollisionResolver\(\);\s*/g, '\n')
        .replace(/\s*const edgeRouter = require\('\.\/edge-router'\)\.getEdgeRouter\(\);\s*/g, '\n')
        .replace(/return types \+ nodePlacer \+ collisionResolver \+ edgeRouter \+ `/g, 'return `');
    const getLayoutEngine = extractGetterContent(getLayoutEngineRaw);

    // 4. html.jsのgenerateHTML, getJavaScriptContent, generateErrorHTML
    const htmlContent = fs.readFileSync('./src/core/generators/html.js', 'utf8');

    // 関数を抽出（次の関数定義またはmodule.exportsまで）
    function extractFunction(content, functionName) {
        const startPattern = new RegExp(`function ${functionName}\\([^)]*\\)\\s*\\{`);
        const match = content.match(startPattern);
        if (!match) return null;

        const startIndex = match.index;

        // 次の関数定義またはmodule.exportsを探す
        const nextFunctionPattern = /\n(?:function |module\.exports)/g;
        nextFunctionPattern.lastIndex = startIndex + match[0].length;
        const nextMatch = nextFunctionPattern.exec(content);

        let endIndex;
        if (nextMatch) {
            // 次の関数の直前までを取得（空行を1つ残す）
            endIndex = nextMatch.index;
        } else {
            // 最後の関数の場合はファイル末尾まで
            endIndex = content.length;
        }

        return content.substring(startIndex, endIndex).trim();
    }

    const generateHTMLCode = extractFunction(htmlContent, 'generateHTML');
    const getJavaScriptContentCode = extractFunction(htmlContent, 'getJavaScriptContent');
    const generateErrorHTMLCode = extractFunction(htmlContent, 'generateErrorHTML');

    code += '// ジェネレーター（html.jsから）\n';
    if (generateHTMLCode) code += generateHTMLCode + '\n\n';
    if (getJavaScriptContentCode) {
        // getJavaScriptContent内の関数呼び出しを実際のコードに置換
        let processedCode = getJavaScriptContentCode
            // V2レイアウトエンジンのコンポーネントを置換
            .replace(/\$\{getLayoutEngine\(\)\}/g, getTypes + '\n' + getNodePlacer + '\n' + getCollisionResolver + '\n' + getEdgeRouter + '\n' + getLayoutEngine)
            .replace(/\$\{getLayoutUtils\(\)\}/g, getLayoutUtils)
            .replace(/\$\{getSVGHelpers\(\)\}/g, getSVGHelpers)
            .replace(/\$\{getTreeStructureAnalyzer\(\)\}/g, getTreeStructureAnalyzer)
            .replace(/\$\{getVerticalLayout\(\)\}/g, getVerticalLayout)
            .replace(/\$\{getConnectionConstants\(\)\}/g, getConnectionConstants)
            .replace(/\$\{getConnectionUtils\(\)\}/g, getConnectionUtils)
            .replace(/\$\{getCollectors\(\)\}/g, getCollectors)
            .replace(/\$\{getDepthUtils\(\)\}/g, getDepthUtils)
            .replace(/\$\{getCollisionUtils\(\)\}/g, getCollisionUtils)
            .replace(/\$\{getPathYAdjuster\(\)\}/g, getPathYAdjuster)
            .replace(/\$\{getPathGenerator\(\)\}/g, getPathGenerator)
            .replace(/\$\{getEdgeSpacingCalculator\(\)\}/g, getEdgeSpacingCalculator)
            .replace(/\$\{getConnectionRenderer\(\)\}/g, getConnectionLabels + '\n' + getVerticalSegmentCalculator + '\n' + getEdgeCrossingDetector + '\n' + getConnectionRenderer)
            .replace(/\$\{getRedrawHelpers\(\)\}/g, getRedrawHelpers)
            .replace(/\$\{getShadowManager\(\)\}/g, getShadowManager)
            .replace(/\$\{getCollapseManager\(\)\}/g, getCollapseManager)
            .replace(/\$\{getLayoutSwitcher\(\)\}/g, getLayoutSwitcher)
            .replace(/\$\{getViewportManager\(\)\}/g, getViewportManager)
            .replace(/\$\{getHighlightManager\(\)\}/g, getHighlightManager)
            .replace(/\$\{getPathHighlighter\(\)\}/g, getPathHighlighter)
            .replace(/\$\{getEdgeHighlighter\(\)\}/g, getEdgeHighlighter)
            .replace(/\$\{getContextMenu\(\)\}/g, getContextMenu)
            .replace(/\$\{getRenderOrchestrator\(\)\}/g, getRenderOrchestrator);

        // </script>をエスケープしてブラウザでscriptタグが閉じられないようにする
        processedCode = processedCode.replace(/<\/script>/g, '<\\/script>');
        code += processedCode + '\n\n';
    }
    if (generateErrorHTMLCode) code += generateErrorHTMLCode + '\n\n';

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