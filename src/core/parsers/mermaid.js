// Parse Mermaid nodes from content
function parseMermaidNodes(content) {
    const nodes = [];
    const nodeMap = new Map();
    const lines = content.split('\n');

    // パターンテンプレート定義（引用符の有無を動的に処理）
    function createPattern(start, end, quoted) {
        const content = quoted ? '"([^"]+)"' : '([^' + end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']+)';
        return new RegExp(`([a-zA-Z0-9_-]+)\\s*${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*${content}\\s*${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    }

    // 形状パターンのテンプレート（長いものから順に）
    const shapeTemplates = [
        { start: '([', end: '])', name: 'Stadium' },
        { start: '[[', end: ']]', name: 'Subroutine' },
        { start: '[(', end: ')]', name: 'Cylinder' },
        { start: '((', end: '))', name: 'Circle' },
        { start: '{{', end: '}}', name: 'Hexagon' },
        { start: '[/', end: '/]', name: 'Trapezoid' },
        { start: '[\\', end: '\\]', name: 'Reverse Trapezoid' },
        { start: '[/', end: '\\]', name: 'Parallelogram' },
        { start: '[\\', end: '/]', name: 'Reverse Parallelogram' },
        { start: '>', end: ']', name: 'Asymmetric' },
        { start: '[', end: ']', name: 'Square' },
        { start: '(', end: ')', name: 'Round' },
        { start: '{', end: '}', name: 'Diamond' }
    ];

    // 引用符付き→引用符なしの順でパターン生成
    const nodePatterns = [];
    shapeTemplates.forEach(template => {
        nodePatterns.push(createPattern(template.start, template.end, true));
    });
    shapeTemplates.forEach(template => {
        nodePatterns.push(createPattern(template.start, template.end, false));
    });

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('%%') || trimmedLine.startsWith('graph') || trimmedLine.startsWith('flowchart')) {
            continue;
        }

        // 形状指定構文をチェック (n1@{ shape: cyl })
        const shapePattern = /^([a-zA-Z0-9_-]+)@\{\s*shape:\s*([a-zA-Z0-9_-]+)\s*\}/;
        const shapeMatch = trimmedLine.match(shapePattern);
        if (shapeMatch) {
            const nodeId = shapeMatch[1];
            const shape = shapeMatch[2];
            if (!nodeMap.has(nodeId)) {
                nodeMap.set(nodeId, { id: nodeId, label: nodeId, shape });
            } else {
                const existingNode = nodeMap.get(nodeId);
                existingNode.shape = shape;
            }
            continue;
        }

        // ショートハンド構文 (:::) をチェック
        const shorthandMatch = trimmedLine.match(/:::([a-zA-Z0-9_-]+)/);
        const shorthandClass = shorthandMatch ? shorthandMatch[1] : null;

        // 単独のショートハンド構文をチェック (例: D:::className)
        const standaloneShorthand = trimmedLine.match(/^([a-zA-Z0-9_-]+):::([a-zA-Z0-9_-]+)$/);
        if (standaloneShorthand) {
            const nodeId = standaloneShorthand[1];
            const className = standaloneShorthand[2];
            if (!nodeMap.has(nodeId)) {
                nodeMap.set(nodeId, { id: nodeId, label: nodeId, classes: [className] });
            } else {
                const existingNode = nodeMap.get(nodeId);
                if (!existingNode.classes) {
                    existingNode.classes = [];
                }
                if (!existingNode.classes.includes(className)) {
                    existingNode.classes.push(className);
                }
            }
            continue;
        }

        // パターンマッチング
        for (const pattern of nodePatterns) {
            const match = trimmedLine.match(pattern);
            if (match) {
                const id = match[1];
                const label = match[2].trim();
                if (!nodeMap.has(id)) {
                    const node = { id, label };
                    if (shorthandClass) {
                        node.classes = [shorthandClass];
                    }
                    nodeMap.set(id, node);
                } else if (shorthandClass) {
                    // 既存のノードにクラスを追加
                    const existingNode = nodeMap.get(id);
                    if (!existingNode.classes) {
                        existingNode.classes = [];
                    }
                    if (!existingNode.classes.includes(shorthandClass)) {
                        existingNode.classes.push(shorthandClass);
                    }
                }
                break;  // 最初にマッチしたパターンで終了
            }
        }
    }

    // 接続からもノードを抽出
    // ラベル付き/なし両方に対応する包括的なパターン
    const connectionExtractionPatterns = [
        // ラベル付き（パイプ記号）: A-->|Label|B
        /^([a-zA-Z0-9_-]+)\s*(?:-->|---|\.->|\.-|==>|===|~~~)\s*\|[^|]*\|\s*([a-zA-Z0-9_-]+)/,
        // ラベル付き（ドット）: A-.Label.->B
        /^([a-zA-Z0-9_-]+)\s*-\.[^\.]+\.(?:->|-)\s*([a-zA-Z0-9_-]+)/,
        // ラベル付き（イコール）: A==Label==>B
        /^([a-zA-Z0-9_-]+)\s*==[^=]+=+>\s*([a-zA-Z0-9_-]+)/,
        // ラベル付き（ハイフン）: A--Label-->B
        /^([a-zA-Z0-9_-]+)\s*--[^-]+--+>\s*([a-zA-Z0-9_-]+)/,
        // ラベルなし: A-->B
        /^([a-zA-Z0-9_-]+)\s*(?:-->|---|\.->|\.-|==>|===|~~~)\s*([a-zA-Z0-9_-]+)/
    ];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('%%') || trimmedLine.startsWith('graph') || trimmedLine.startsWith('flowchart')) {
            continue;
        }

        for (const pattern of connectionExtractionPatterns) {
            const match = trimmedLine.match(pattern);
            if (match) {
                const fromId = match[1];
                const toId = match[2];

                // ノードが定義されていない場合、IDをラベルとして使用
                if (!nodeMap.has(fromId)) {
                    nodeMap.set(fromId, { id: fromId, label: fromId });
                }
                if (!nodeMap.has(toId)) {
                    nodeMap.set(toId, { id: toId, label: toId });
                }
                break;
            }
        }
    }

    return Array.from(nodeMap.values());
}

// Parse Mermaid connections from content
function parseMermaidConnections(content) {
    const connections = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('%%') || trimmedLine.startsWith('graph') || trimmedLine.startsWith('flowchart')) {
            continue;
        }

        // 複数ターゲット構文をチェック (A --> B & C)
        // &が含まれている場合のみ処理
        if (trimmedLine.includes('&')) {
            const multiTargetPattern = /([a-zA-Z0-9_-]+(?:\[[^\]]+\])?)\s*(-->|---|\.->|\.-|==>|===|~~~)\s*(.+)/;
            const multiTargetMatch = trimmedLine.match(multiTargetPattern);

            if (multiTargetMatch) {
                const fromPart = multiTargetMatch[1].trim();
                const arrow = multiTargetMatch[2];
                const toPart = multiTargetMatch[3].trim();

                // fromからノードIDを抽出
                const fromIdMatch = fromPart.match(/^([a-zA-Z0-9_-]+)/);
                if (!fromIdMatch) continue;
                const from = fromIdMatch[1];

                // &で分割してターゲットを抽出
                const targets = toPart.split('&').map(t => t.trim());

                // 複数ターゲットの場合のみ処理
                if (targets.length > 1) {
                    const isDashed = arrow.includes('.-');
                    for (const target of targets) {
                        // ターゲットからノードIDを抽出
                        const targetIdMatch = target.match(/^([a-zA-Z0-9_-]+)/);
                        if (targetIdMatch) {
                            const to = targetIdMatch[1];
                            const conn = { from, to };
                            if (isDashed) conn.isDashed = true;
                            connections.push(conn);
                        }
                    }
                    continue;
                }
            }
        }

        // 接続パターン生成関数
        function createConnectionPattern(arrow, labelType, quoted) {
            const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (labelType === 'pipe') {
                const label = quoted ? '"([^"]+)"' : '([^|]+)';
                return { pattern: new RegExp(`^([a-zA-Z0-9_-]+)\\s*${esc(arrow)}\\s*\\|\\s*${label}\\s*\\|\\s*([a-zA-Z0-9_-]+)`), hasLabel: true };
            } else if (labelType === 'wrap') {
                const prefix = arrow.substring(0, 2);
                const suffix = arrow.substring(2);
                const label = quoted ? '"([^"]+)"' : `([^${esc(prefix[0])}]+)`;
                return { pattern: new RegExp(`^([a-zA-Z0-9_-]+)\\s*${esc(prefix)}\\s*${label}\\s*${esc(suffix)}\\s*([a-zA-Z0-9_-]+)`), hasLabel: true };
            } else {
                return { pattern: new RegExp(`^([a-zA-Z0-9_-]+)\\s*${esc(arrow)}\\s*([a-zA-Z0-9_-]+)`), hasLabel: false };
            }
        }

        // 接続タイプ定義
        const arrowTypes = ['-->', '---', '.->', '.-', '==>', '===', '~~~'];
        const labelArrows = ['-->', '---', '.->', '.-', '==>', '==='];

        // パターン生成（優先順位: パイプラベル > ラップラベル > ラベルなし）
        const connectionPatterns = [];
        labelArrows.forEach(arrow => {
            connectionPatterns.push(createConnectionPattern(arrow, 'pipe', true));
        });
        labelArrows.forEach(arrow => {
            connectionPatterns.push(createConnectionPattern(arrow, 'pipe', false));
        });
        labelArrows.forEach(arrow => {
            connectionPatterns.push(createConnectionPattern(arrow, 'wrap', true));
        });
        labelArrows.forEach(arrow => {
            connectionPatterns.push(createConnectionPattern(arrow, 'wrap', false));
        });
        arrowTypes.forEach(arrow => {
            connectionPatterns.push(createConnectionPattern(arrow, 'none', false));
        });

        for (const patternObj of connectionPatterns) {
            const match = trimmedLine.match(patternObj.pattern);
            if (match) {
                const isDashed = trimmedLine.includes('.-');
                if (patternObj.hasLabel) {
                    const from = match[1];
                    const label = match[2].trim();
                    const to = match[3];
                    const conn = { from, to, label };
                    if (isDashed) conn.isDashed = true;
                    connections.push(conn);
                } else {
                    const from = match[1];
                    const to = match[2];
                    const conn = { from, to };
                    if (isDashed) conn.isDashed = true;
                    connections.push(conn);
                }
                break;
            }
        }
    }

    return connections;
}

// Parse Mermaid style definitions from content
function parseMermaidStyles(content) {
    const styles = {};
    const lines = content.split('\n');

    // style nodeId fill:#f9f,stroke:#333,stroke-width:4px
    const stylePattern = /^\s*style\s+([a-zA-Z0-9_-]+)\s+(.+)/;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('%%')) {
            continue;
        }

        const match = trimmedLine.match(stylePattern);
        if (match) {
            const nodeId = match[1];
            const styleString = match[2].trim();

            // Parse style properties (fill:#f9f,stroke:#333,stroke-width:4px)
            const styleObj = {};
            const properties = styleString.split(',');

            for (const prop of properties) {
                const [key, value] = prop.split(':').map(s => s.trim());
                if (key && value) {
                    styleObj[key] = value;
                }
            }

            styles[nodeId] = styleObj;
        }
    }

    return styles;
}

// Parse Mermaid class definitions from content
function parseMermaidClassDefs(content) {
    const classDefs = {};
    const classAssignments = {};
    const lines = content.split('\n');

    // classDef className fill:#f9f,stroke:#333,stroke-width:4px
    const classDefPattern = /^\s*classDef\s+([a-zA-Z0-9_-]+)\s+(.+)/;

    // class nodeId1,nodeId2 className
    const classPattern = /^\s*class\s+([a-zA-Z0-9_,-]+)\s+([a-zA-Z0-9_-]+)/;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('%%')) {
            continue;
        }

        // Parse classDef
        const classDefMatch = trimmedLine.match(classDefPattern);
        if (classDefMatch) {
            const className = classDefMatch[1];
            const styleString = classDefMatch[2].trim();

            // Parse style properties
            const styleObj = {};
            const properties = styleString.split(',');

            for (const prop of properties) {
                const [key, value] = prop.split(':').map(s => s.trim());
                if (key && value) {
                    styleObj[key] = value;
                }
            }

            classDefs[className] = styleObj;
            continue;
        }

        // Parse class assignments
        const classMatch = trimmedLine.match(classPattern);
        if (classMatch) {
            const nodeIds = classMatch[1].split(',').map(id => id.trim());
            const className = classMatch[2];

            for (const nodeId of nodeIds) {
                if (!classAssignments[nodeId]) {
                    classAssignments[nodeId] = [];
                }
                classAssignments[nodeId].push(className);
            }
        }
    }

    return { classDefs, classAssignments };
}

module.exports = {
    parseMermaidNodes,
    parseMermaidConnections,
    parseMermaidStyles,
    parseMermaidClassDefs
};