const { getBaseTemplate } = require('../../templates/base');
const { collectAllModules } = require('../../shared/module-collector');

function generateHTML(nodes, connections, styles = {}, classDefs = {}, dashedNodes = [], dashedEdges = []) {
    const template = getBaseTemplate();

    let html = template.htmlStructure.doctype + '\n';
    html += template.htmlStructure.htmlOpen + '\n';
    html += template.htmlStructure.headOpen + '\n';
    html += '    ' + template.htmlStructure.title + '\n';
    html += '    <style>\n';
    html += template.css + '\n';
    html += '    </style>\n';
    html += template.htmlStructure.headClose + '\n';
    html += template.htmlStructure.bodyOpen + '\n';
    html += '    ' + template.htmlStructure.layoutControls + '\n';
    html += '    ' + template.htmlStructure.containerOpen + '\n';
    html += '    ' + template.htmlStructure.containerClose + '\n';
    html += getJavaScriptContent(nodes, connections, styles, classDefs, dashedNodes, dashedEdges);
    html += template.htmlStructure.bodyClose + '\n';
    html += template.htmlStructure.htmlClose;

    return html;
}

function getJavaScriptContent(nodes, connections, styles = {}, classDefs = {}, dashedNodes = [], dashedEdges = []) {
    const runtimeModules = collectAllModules({
        includeParser: false,
        includeGenerator: false,
        mode: 'require'
    });

    return `    <script>
        const nodes = ${JSON.stringify(nodes)};
        const connections = ${JSON.stringify(connections)};
        const styles = ${JSON.stringify(styles)};
        const classDefs = ${JSON.stringify(classDefs)};
        const dashedNodes = ${JSON.stringify(dashedNodes)};
        const dashedEdges = ${JSON.stringify(dashedEdges)};

        // 全ノードと全エッジ（点線含む）
        const allNodes = [...nodes, ...dashedNodes];
        const allConnections = [...connections, ...dashedEdges];

        // デバッグフラグ（ブラウザコンソールで window.DEBUG_CONNECTIONS = true で有効化）
        window.DEBUG_CONNECTIONS = false;

        ${runtimeModules}

        // スタイルを適用
        function applyNodeStyle(element, nodeId, nodeClasses) {
            const styleObj = {};

            // クラスからスタイルを適用
            if (nodeClasses && nodeClasses.length > 0) {
                nodeClasses.forEach(className => {
                    if (classDefs[className]) {
                        Object.assign(styleObj, classDefs[className]);
                    }
                });
            }

            // 直接スタイルを適用（優先度が高い）
            if (styles[nodeId]) {
                Object.assign(styleObj, styles[nodeId]);
            }

            // SVG要素にスタイルを適用
            if (Object.keys(styleObj).length > 0) {
                for (const [key, value] of Object.entries(styleObj)) {
                    element.style[key] = value;
                }
            }
        }

        // エントリーポイント
        window.onload = function() {
            initializeAndRender();
        };
    </script>`;
}

function generateErrorHTML(errors) {
    const errorList = errors.map(err => `            <li>${err}</li>`).join('\n');

    return `<!DOCTYPE html>
<html>
<head>
    <title>エラー - Mermaid Tree</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            background-color: #f5f5f5;
        }
        .error-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #d32f2f;
            margin-top: 0;
        }
        .error-message {
            background: #ffebee;
            border-left: 4px solid #d32f2f;
            padding: 15px;
            margin: 20px 0;
        }
        ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        li {
            margin: 8px 0;
            line-height: 1.6;
        }
        .info {
            color: #666;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>⚠ グラフ構造が不正なため描画できません</h1>
        <div class="error-message">
            <strong>検出されたエラー:</strong>
            <ul>
${errorList}
            </ul>
        </div>
        <div class="info">
            <p>このツールはDAG（有向非巡環グラフ）構造のMermaid図をサポートしています。</p>
            <p>サポートされる構造の条件:</p>
            <ul>
                <li>ルートノード（親を持たないノード）が存在する</li>
                <li>サイクル（循環参照）が存在しない</li>
                <li>複数の親を持つノードは許容されます</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
}

function generateHTMLWithCollapse(nodes, connections) {
    const html = `<html>
<head>
<style>
    .collapse-button { cursor: pointer; }
    .collapsed-node {
        box-shadow: 2px 2px 4px rgba(0,0,0,0.3),
                    4px 4px 8px rgba(0,0,0,0.2);
    }
</style>
</head>
<body>
</body>
</html>`;
    return html;
}

module.exports = {
    generateHTML,
    generateErrorHTML,
    generateHTMLWithCollapse
};