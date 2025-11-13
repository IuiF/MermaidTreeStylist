const fs = require('fs');
const path = require('path');

/**
 * 関数を抽出するヘルパー関数
 */
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
        endIndex = nextMatch.index;
    } else {
        endIndex = content.length;
    }

    let extracted = content.substring(startIndex, endIndex).trim();

    // 末尾の空行とコメント行を削除
    const lines = extracted.split('\n');
    while (lines.length > 0) {
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine === '' || lastLine.startsWith('//')) {
            lines.pop();
        } else {
            break;
        }
    }

    return lines.join('\n');
}

/**
 * ランタイムモジュールを収集（get関数経由）
 */
function collectRuntimeModulesViaRequire() {
    const { getBaseTemplate } = require('../templates/base');
    const { getLayoutUtils } = require('./layout-utils');
    const { getTreeStructureAnalyzer } = require('./tree-structure');
    const { getSVGHelpers } = require('./svg-helpers');
    const { getVerticalLayout } = require('../core/layouts/vertical-layout');
    const { getConnectionConstants } = require('../runtime/rendering/connections/constants');
    const { getConnectionUtils } = require('../runtime/rendering/connections/utils');
    const { getCollectors } = require('../runtime/rendering/connections/collectors');
    const { getDepthUtils } = require('../runtime/rendering/connections/depth-utils');
    const { getPathYAdjuster } = require('../runtime/rendering/connections/path-y-adjuster');
    const { getPathGenerator } = require('../runtime/rendering/connections/path-generator');
    const { getEdgeSpacingCalculator } = require('../runtime/rendering/connections/edge-spacing-calculator');
    const { getCollisionUtils } = require('../runtime/rendering/connections/collision-utils');
    const { getConnectionRenderer } = require('../runtime/rendering/connections/renderer');
    const { getRedrawHelpers } = require('../runtime/rendering/redraw-helpers');
    const { getShadowManager } = require('../runtime/rendering/effects/shadow-manager');
    const { getCollapseManager } = require('../runtime/state/collapse-manager');
    const { getLayoutSwitcher } = require('../runtime/ui/layout-switcher');
    const { getViewportManager } = require('../runtime/ui/viewport-manager');
    const { getContextMenu } = require('../runtime/ui/context-menu');
    const { getHighlightManager } = require('../runtime/state/highlight-manager');
    const { getPathHighlighter } = require('../runtime/state/path-highlighter');
    const { getEdgeHighlighter } = require('../runtime/state/edge-highlighter');
    const { getRenderOrchestrator } = require('../runtime/core/render-orchestrator');
    const { getLayoutEngine } = require('../core/layout/layout-engine');

    return `
        // Import utilities
        ${getLayoutUtils()}
        ${getSVGHelpers()}

        // Import tree structure analyzer
        ${getTreeStructureAnalyzer()}

        // Import layouts
        ${getVerticalLayout()}

        // Import connection constants
        ${getConnectionConstants()}

        // Import connection utils
        ${getConnectionUtils()}

        // Import collectors (edge info, bounds)
        ${getCollectors()}

        // Import depth utils (calculator, offset aggregator)
        ${getDepthUtils()}

        // Import collision utils (detector, avoidance calculator)
        ${getCollisionUtils()}

        // Import path Y adjuster
        ${getPathYAdjuster()}

        // Import path generator
        ${getPathGenerator()}

        // Import edge spacing calculator
        ${getEdgeSpacingCalculator()}

        // Import connection renderer
        ${getConnectionRenderer()}

        // Import redraw helpers
        ${getRedrawHelpers()}

        // Import shadow manager
        ${getShadowManager()}

        // Import collapse manager
        ${getCollapseManager()}

        // Import layout switcher
        ${getLayoutSwitcher()}

        // Import viewport manager
        ${getViewportManager()}

        // Import highlight manager
        ${getHighlightManager()}

        // Import path highlighter
        ${getPathHighlighter()}

        // Import edge highlighter
        ${getEdgeHighlighter()}

        // Import context menu
        ${getContextMenu()}

        // Import render orchestrator
        ${getRenderOrchestrator()}

        // Import V2 layout engine
        ${getLayoutEngine()}
    `;
}

/**
 * ランタイムモジュールを収集（ファイル読み込み経由）
 */
function collectRuntimeModulesViaFileSystem(baseDir) {
    const readAndClean = (relativePath) => {
        const fullPath = path.join(baseDir, relativePath);
        return fs.readFileSync(fullPath, 'utf8')
            .replace(/module\.exports = \{[^}]+\};?/g, '');
    };

    const getBaseTemplate = readAndClean('./src/templates/base.js');
    const getLayoutUtils = readAndClean('./src/shared/layout-utils.js');
    const getSVGHelpers = readAndClean('./src/shared/svg-helpers.js');
    const getTreeStructureAnalyzer = readAndClean('./src/shared/tree-structure.js');
    const getVerticalLayout = readAndClean('./src/core/layouts/vertical-layout.js');
    const getConnectionConstants = readAndClean('./src/runtime/rendering/connections/constants.js');
    const getConnectionUtils = readAndClean('./src/runtime/rendering/connections/utils.js');
    const getCollectors = readAndClean('./src/runtime/rendering/connections/collectors.js');
    const getDepthUtils = readAndClean('./src/runtime/rendering/connections/depth-utils.js');
    const getCollisionUtils = readAndClean('./src/runtime/rendering/connections/collision-utils.js');
    const getPathYAdjuster = readAndClean('./src/runtime/rendering/connections/path-y-adjuster.js');
    const getPathGenerator = readAndClean('./src/runtime/rendering/connections/path-generator.js');
    const getEdgeSpacingCalculator = readAndClean('./src/runtime/rendering/connections/edge-spacing-calculator.js');
    const getConnectionLabels = readAndClean('./src/runtime/rendering/connections/labels.js');
    const getVerticalSegmentCalculator = readAndClean('./src/runtime/rendering/connections/vertical-segment-calculator.js');
    const getEdgeCrossingDetector = readAndClean('./src/runtime/rendering/connections/edge-crossing-detector.js');

    let getConnectionRenderer = readAndClean('./src/runtime/rendering/connections/renderer.js');
    getConnectionRenderer = getConnectionRenderer
        .replace(/\s*const connectionLabels = require\('\.\/labels'\)\.getConnectionLabels\(\);\s*/g, '\n')
        .replace(/\s*const verticalSegmentCalculator = require\('\.\/vertical-segment-calculator'\)\.getVerticalSegmentCalculator\(\);\s*/g, '\n')
        .replace(/\s*const edgeCrossingDetector = require\('\.\/edge-crossing-detector'\)\.getEdgeCrossingDetector\(\);\s*/g, '\n')
        .replace(/return connectionLabels \+ verticalSegmentCalculator \+ edgeCrossingDetector \+ `/g, 'return getConnectionLabels() + getVerticalSegmentCalculator() + getEdgeCrossingDetector() + `');

    const getRedrawHelpers = readAndClean('./src/runtime/rendering/redraw-helpers.js');
    const getShadowManager = readAndClean('./src/runtime/rendering/effects/shadow-manager.js');
    const getCollapseManager = readAndClean('./src/runtime/state/collapse-manager.js');
    const getLayoutSwitcher = readAndClean('./src/runtime/ui/layout-switcher.js');
    const getViewportManager = readAndClean('./src/runtime/ui/viewport-manager.js');
    const getHighlightManager = readAndClean('./src/runtime/state/highlight-manager.js');
    const getPathHighlighter = readAndClean('./src/runtime/state/path-highlighter.js');
    const getEdgeHighlighter = readAndClean('./src/runtime/state/edge-highlighter.js');
    const getContextMenu = readAndClean('./src/runtime/ui/context-menu.js');
    const getRenderOrchestrator = readAndClean('./src/runtime/core/render-orchestrator.js');

    const getTypes = readAndClean('./src/core/layout/types.js');
    const getNodePlacer = readAndClean('./src/core/layout/node-placer.js');
    const getCollisionResolver = readAndClean('./src/core/layout/collision-resolver.js');
    const getEdgeRouter = readAndClean('./src/core/layout/edge-router.js');

    let getLayoutEngine = readAndClean('./src/core/layout/layout-engine.js');
    getLayoutEngine = getLayoutEngine
        .replace(/\s*const types = require\('\.\/types'\)\.getTypes\(\);\s*/g, '\n')
        .replace(/\s*const nodePlacer = require\('\.\/node-placer'\)\.getNodePlacer\(\);\s*/g, '\n')
        .replace(/\s*const collisionResolver = require\('\.\/collision-resolver'\)\.getCollisionResolver\(\);\s*/g, '\n')
        .replace(/\s*const edgeRouter = require\('\.\/edge-router'\)\.getEdgeRouter\(\);\s*/g, '\n')
        .replace(/return types \+ nodePlacer \+ collisionResolver \+ edgeRouter \+ `/g, 'return getTypes() + getNodePlacer() + getCollisionResolver() + getEdgeRouter() + `');

    let code = '';

    code += '// テンプレートとユーティリティ\n';
    code += getBaseTemplate + '\n';
    code += getLayoutUtils + '\n';
    code += getSVGHelpers + '\n';
    code += getTreeStructureAnalyzer + '\n\n';

    code += '// レイアウト\n';
    code += getVerticalLayout + '\n\n';

    code += '// 接続描画機能\n';
    code += getConnectionConstants + '\n';
    code += getConnectionUtils + '\n';
    code += getCollectors + '\n';
    code += getDepthUtils + '\n';
    code += getCollisionUtils + '\n';
    code += getPathYAdjuster + '\n';
    code += getPathGenerator + '\n';
    code += getEdgeSpacingCalculator + '\n';
    code += getConnectionLabels + '\n';
    code += getVerticalSegmentCalculator + '\n';
    code += getEdgeCrossingDetector + '\n';
    code += getConnectionRenderer + '\n';
    code += 'eval(getConnectionLabels());\n';
    code += 'eval(getVerticalSegmentCalculator());\n';
    code += 'eval(getEdgeCrossingDetector());\n';
    code += 'eval(getConnectionRenderer());\n\n';

    code += '// レンダリング機能\n';
    code += getRedrawHelpers + '\n';
    code += getShadowManager + '\n\n';

    code += '// 状態管理\n';
    code += getCollapseManager + '\n';
    code += getHighlightManager + '\n';
    code += getPathHighlighter + '\n';
    code += getEdgeHighlighter + '\n\n';

    code += '// UI機能\n';
    code += getLayoutSwitcher + '\n';
    code += getViewportManager + '\n';
    code += getContextMenu + '\n\n';

    code += '// コアシステム\n';
    code += getRenderOrchestrator + '\n\n';

    code += '// V2レイアウトエンジン\n';
    code += getTypes + '\n';
    code += getNodePlacer + '\n';
    code += getCollisionResolver + '\n';
    code += getEdgeRouter + '\n';
    code += getLayoutEngine + '\n';
    code += 'eval(getTypes());\n';
    code += 'eval(getNodePlacer());\n';
    code += 'eval(getCollisionResolver());\n';
    code += 'eval(getEdgeRouter());\n';
    code += 'eval(getLayoutEngine());\n\n';

    return code;
}

/**
 * パーサーとバリデーターを収集
 */
function collectParserModules(baseDir) {
    const parserPath = path.join(baseDir, './src/core/parsers/mermaid.js');
    const validatorPath = path.join(baseDir, './src/core/validators/tree-validator.js');
    const mainPath = path.join(baseDir, './cli/main.js');

    const parserContent = fs.readFileSync(parserPath, 'utf8');
    const validatorContent = fs.readFileSync(validatorPath, 'utf8');
    const mainContent = fs.readFileSync(mainPath, 'utf8');

    const parseMermaidNodesCode = extractFunction(parserContent, 'parseMermaidNodes');
    const parseMermaidConnectionsCode = extractFunction(parserContent, 'parseMermaidConnections');
    const parseMermaidStylesCode = extractFunction(parserContent, 'parseMermaidStyles');
    const parseMermaidClassDefsCode = extractFunction(parserContent, 'parseMermaidClassDefs');
    const validateTreeStructureCode = extractFunction(validatorContent, 'validateTreeStructure');
    const createDashedNodesAndEdgesCode = extractFunction(mainContent, 'createDashedNodesAndEdges');

    let code = '';
    code += '// パーサー\n';
    if (parseMermaidNodesCode) code += parseMermaidNodesCode + '\n\n';
    if (parseMermaidConnectionsCode) code += parseMermaidConnectionsCode + '\n\n';
    if (parseMermaidStylesCode) code += parseMermaidStylesCode + '\n\n';
    if (parseMermaidClassDefsCode) code += parseMermaidClassDefsCode + '\n\n';

    code += '// バリデーター\n';
    if (validateTreeStructureCode) code += validateTreeStructureCode + '\n\n';

    code += '// バックエッジ処理\n';
    if (createDashedNodesAndEdgesCode) code += createDashedNodesAndEdgesCode + '\n\n';

    return code;
}

/**
 * ジェネレーター関数を収集
 */
function collectGeneratorModules(baseDir) {
    const htmlPath = path.join(baseDir, './src/core/generators/html.js');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const generateHTMLCode = extractFunction(htmlContent, 'generateHTML');
    const getJavaScriptContentCode = extractFunction(htmlContent, 'getJavaScriptContent');
    const generateErrorHTMLCode = extractFunction(htmlContent, 'generateErrorHTML');

    let code = '';
    code += '// ジェネレーター\n';
    if (generateHTMLCode) code += generateHTMLCode + '\n\n';
    if (getJavaScriptContentCode) {
        code += getJavaScriptContentCode.replace(/<\/script>/g, '<\\/script>') + '\n\n';
    }
    if (generateErrorHTMLCode) code += generateErrorHTMLCode + '\n\n';

    return code;
}

/**
 * 統一されたモジュール収集関数
 * @param {Object} options - オプション
 * @param {boolean} options.includeParser - パーサーを含むか
 * @param {boolean} options.includeGenerator - ジェネレーターを含むか
 * @param {string} options.mode - 'require'（CLI向け）または'filesystem'（Web向け）
 * @param {string} options.baseDir - ファイルシステムモードの場合のベースディレクトリ
 * @returns {string} 収集されたモジュールコード
 */
function collectAllModules(options = {}) {
    const {
        includeParser = false,
        includeGenerator = false,
        mode = 'require',
        baseDir = process.cwd()
    } = options;

    let code = '';

    // パーサーを含む場合
    if (includeParser) {
        code += collectParserModules(baseDir);
    }

    // ランタイムモジュール（常に含む）
    if (mode === 'require') {
        code += collectRuntimeModulesViaRequire();
    } else if (mode === 'filesystem') {
        code += collectRuntimeModulesViaFileSystem(baseDir);
    }

    // ジェネレーターを含む場合
    if (includeGenerator) {
        code += collectGeneratorModules(baseDir);
    }

    return code;
}

module.exports = {
    collectAllModules,
    collectRuntimeModulesViaRequire,
    collectRuntimeModulesViaFileSystem,
    collectParserModules,
    collectGeneratorModules
};
