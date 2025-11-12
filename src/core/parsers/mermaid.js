// Parse Mermaid nodes from content
function parseMermaidNodes(content) {
    const nodes = [];
    const nodeMap = new Map();
    const lines = content.split('\n');

    // ノード定義パターン（様々な形状に対応）
    // より複雑なパターンを先に、シンプルなパターンを後に配置
    const nodePatterns = [
        // 引用符付き複雑な形状（長いパターンを先に）
        /([a-zA-Z0-9_-]+)\s*\(\[\s*"([^"]+)"\s*\]\)/,  // Stadium
        /([a-zA-Z0-9_-]+)\s*\[\[\s*"([^"]+)"\s*\]\]/,  // Subroutine
        /([a-zA-Z0-9_-]+)\s*\[\(\s*"([^"]+)"\s*\)\]/,  // Cylinder
        /([a-zA-Z0-9_-]+)\s*\(\(\s*"([^"]+)"\s*\)\)/,  // Circle
        /([a-zA-Z0-9_-]+)\s*\{\{\s*"([^"]+)"\s*\}\}/,  // Hexagon
        /([a-zA-Z0-9_-]+)\s*\[\/\s*"([^"]+)"\s*\/\]/,  // Trapezoid
        /([a-zA-Z0-9_-]+)\s*\[\\\s*"([^"]+)"\s*\\\]/,  // Reverse Trapezoid
        /([a-zA-Z0-9_-]+)\s*\[\/\s*"([^"]+)"\s*\\\]/,  // Parallelogram
        /([a-zA-Z0-9_-]+)\s*\[\\\s*"([^"]+)"\s*\/\]/,  // Reverse Parallelogram
        /([a-zA-Z0-9_-]+)\s*>\s*"([^"]+)"\s*\]/,        // Asymmetric

        // 引用符付きシンプルな形状
        /([a-zA-Z0-9_-]+)\s*\[\s*"([^"]+)"\s*\]/,  // Square
        /([a-zA-Z0-9_-]+)\s*\(\s*"([^"]+)"\s*\)/,  // Round
        /([a-zA-Z0-9_-]+)\s*\{\s*"([^"]+)"\s*\}/,  // Diamond

        // 引用符なし複雑な形状（長いパターンを先に）
        /([a-zA-Z0-9_-]+)\s*\(\[\s*([^\]]+)\s*\]\)/,  // Stadium
        /([a-zA-Z0-9_-]+)\s*\[\[\s*([^\]]+)\s*\]\]/,  // Subroutine
        /([a-zA-Z0-9_-]+)\s*\[\(\s*([^\)]+)\s*\)\]/,  // Cylinder
        /([a-zA-Z0-9_-]+)\s*\(\(\s*([^\)]+)\s*\)\)/,  // Circle
        /([a-zA-Z0-9_-]+)\s*\{\{\s*([^\}]+)\s*\}\}/,  // Hexagon
        /([a-zA-Z0-9_-]+)\s*\[\/\s*([^\/\]]+)\s*\/\]/,  // Trapezoid
        /([a-zA-Z0-9_-]+)\s*\[\\\s*([^\\\]]+)\s*\\\]/,  // Reverse Trapezoid
        /([a-zA-Z0-9_-]+)\s*\[\/\s*([^\\\]]+)\s*\\\]/,  // Parallelogram
        /([a-zA-Z0-9_-]+)\s*\[\\\s*([^\/\]]+)\s*\/\]/,  // Reverse Parallelogram
        /([a-zA-Z0-9_-]+)\s*>\s*([^\]]+)\s*\]/,        // Asymmetric

        // 引用符なしシンプルな形状（最後に）
        /([a-zA-Z0-9_-]+)\s*\[\s*([^\]]+)\s*\]/,  // Square
        /([a-zA-Z0-9_-]+)\s*\(\s*([^\)]+)\s*\)/,  // Round
        /([a-zA-Z0-9_-]+)\s*\{\s*([^\}]+)\s*\}/   // Diamond
    ];

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

        // 接続記号を含む行はスキップ（接続行からのノード抽出は後で行う）
        if (/-->|---|-\.->|-\.-|==>|===|~~~/.test(trimmedLine)) {
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
        // 点線パターンを先に（非貪欲マッチ）
        /^([a-zA-Z0-9_-]+?)\s*(?:-\.->|-\.-)\s*\|[^|]*\|\s*([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]+?)\s*-\.[^\.]+\.(?:->|-)\s*([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]+?)\s*(?:-\.->|-\.-)\s*([a-zA-Z0-9_-]+)/,
        // ラベル付き（パイプ記号）: A-->|Label|B
        /^([a-zA-Z0-9_-]+)\s*(?:-->|---)\s*\|[^|]*\|\s*([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]+)\s*(?:==>|===|~~~)\s*\|[^|]*\|\s*([a-zA-Z0-9_-]+)/,
        // ラベル付き（イコール）: A==Label==>B
        /^([a-zA-Z0-9_-]+)\s*==[^=]+=+>\s*([a-zA-Z0-9_-]+)/,
        // ラベル付き（ハイフン）: A--Label-->B
        /^([a-zA-Z0-9_-]+)\s*--[^-]+--+>\s*([a-zA-Z0-9_-]+)/,
        // ラベルなし: A-->B
        /^([a-zA-Z0-9_-]+)\s*(?:-->|---|==>|===|~~~)\s*([a-zA-Z0-9_-]+)/
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

        // 従来の接続パターン（様々なタイプに対応）
        // 注意: 点線パターン(-.->、-.-)は先頭に配置してハイフンとの混同を避ける
        const connectionPatterns = [
            // 点線パターン - シンプルな接続（ラベルなし）を先に
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.->\s*([a-zA-Z0-9_-]+)/, hasLabel: false },
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.-\s*([a-zA-Z0-9_-]+)/, hasLabel: false },

            // 点線パターン - パイプ記号でラベル（引用符付き）
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.->\s*\|\s*"([^"]+)"\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.-\s*\|\s*"([^"]+)"\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },

            // 点線パターン - パイプ記号でラベル（引用符なし）
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.->\s*\|\s*([^|]+)\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.-\s*\|\s*([^|]+)\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },

            // 点線パターン - ドットで囲むラベル（引用符付き）
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.\s*"([^"]+)"\s*\.->\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.\s*"([^"]+)"\s*\.-\s*([a-zA-Z0-9_-]+)/, hasLabel: true },

            // 点線パターン - ドットで囲むラベル（引用符なし）
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.\s*([^\.]+)\s*\.->\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+?)\s*-\.\s*([^\.]+)\s*\.-\s*([a-zA-Z0-9_-]+)/, hasLabel: true },

            // パイプ記号でラベル（引用符付き）
            { pattern: /^([a-zA-Z0-9_-]+)\s*-->\s*\|\s*"([^"]+)"\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*---\s*\|\s*"([^"]+)"\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*==>\s*\|\s*"([^"]+)"\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*===\s*\|\s*"([^"]+)"\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },

            // パイプ記号でラベル（引用符なし）
            { pattern: /^([a-zA-Z0-9_-]+)\s*-->\s*\|\s*([^|]+)\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*---\s*\|\s*([^|]+)\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*==>\s*\|\s*([^|]+)\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*===\s*\|\s*([^|]+)\s*\|\s*([a-zA-Z0-9_-]+)/, hasLabel: true },

            // ハイフン/イコールで囲むラベル（引用符付き）
            { pattern: /^([a-zA-Z0-9_-]+)\s*--\s*"([^"]+)"\s*-->\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*--\s*"([^"]+)"\s*---\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*==\s*"([^"]+)"\s*==>\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*==\s*"([^"]+)"\s*===\s*([a-zA-Z0-9_-]+)/, hasLabel: true },

            // ハイフン/イコールで囲むラベル（引用符なし）
            { pattern: /^([a-zA-Z0-9_-]+)\s*--\s*([^-]+)\s*-->\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*--\s*([^-]+)\s*---\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*==\s*([^=]+)\s*==>\s*([a-zA-Z0-9_-]+)/, hasLabel: true },
            { pattern: /^([a-zA-Z0-9_-]+)\s*==\s*([^=]+)\s*===\s*([a-zA-Z0-9_-]+)/, hasLabel: true },

            // シンプルな接続（ラベルなし）
            { pattern: /^([a-zA-Z0-9_-]+)\s*-->\s*([a-zA-Z0-9_-]+)/, hasLabel: false },
            { pattern: /^([a-zA-Z0-9_-]+)\s*---\s*([a-zA-Z0-9_-]+)/, hasLabel: false },
            { pattern: /^([a-zA-Z0-9_-]+)\s*==>\s*([a-zA-Z0-9_-]+)/, hasLabel: false },
            { pattern: /^([a-zA-Z0-9_-]+)\s*===\s*([a-zA-Z0-9_-]+)/, hasLabel: false },
            { pattern: /^([a-zA-Z0-9_-]+)\s*~~~\s*([a-zA-Z0-9_-]+)/, hasLabel: false }
        ];

        for (const patternObj of connectionPatterns) {
            const match = trimmedLine.match(patternObj.pattern);
            if (match) {
                const isDashed = /-\.->|-\.-/.test(trimmedLine);
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