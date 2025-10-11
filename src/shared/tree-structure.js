function getTreeStructureAnalyzer() {
    return `
        function analyzeTreeStructure(nodes, connections, dashedNodesParam = []) {
            const childNodes = new Set(connections.map(c => c.to));
            let rootNodes = nodes.filter(node => !childNodes.has(node.id));

            // ルートノードがない場合は、最初のノードをルートとする
            if (rootNodes.length === 0 && nodes.length > 0) {
                rootNodes = [nodes[0]];
            }

            const childrenMap = new Map();
            const parentsMap = new Map();

            connections.forEach(conn => {
                if (!childrenMap.has(conn.from)) {
                    childrenMap.set(conn.from, []);
                }
                childrenMap.get(conn.from).push(conn.to);

                if (!parentsMap.has(conn.to)) {
                    parentsMap.set(conn.to, []);
                }
                parentsMap.get(conn.to).push(conn.from);
            });

            // 各ノードの階層レベルを計算（複数の親がある場合は最も浅い階層+1）
            const nodeLevel = new Map();
            const queue = [];

            // ルートノードをレベル0として開始
            rootNodes.forEach(rootNode => {
                nodeLevel.set(rootNode.id, 0);
                queue.push(rootNode.id);
            });

            // BFSで階層を計算（複数回訪問を許可し、より浅い階層を採用）
            let processed = 0;
            const maxIterations = nodes.length * nodes.length;

            while (queue.length > 0 && processed < maxIterations) {
                const currentId = queue.shift();
                processed++;
                const currentLevel = nodeLevel.get(currentId);
                const children = childrenMap.get(currentId) || [];

                for (const childId of children) {
                    const newLevel = currentLevel + 1;
                    const existingLevel = nodeLevel.get(childId);

                    // より浅い階層が見つかった場合、または未設定の場合は更新
                    if (existingLevel === undefined || newLevel < existingLevel) {
                        nodeLevel.set(childId, newLevel);
                        queue.push(childId);
                    }
                }
            }

            // 点線ノードの階層を設定（BFSで計算された値とminDepthの大きい方を使用）
            dashedNodesParam.forEach(dashedNode => {
                const existingLevel = nodeLevel.get(dashedNode.id);
                const finalLevel = existingLevel !== undefined ? Math.max(existingLevel, dashedNode.minDepth) : dashedNode.minDepth;
                if (window.DEBUG_CONNECTIONS) {
                    console.log('Setting level for dashed node ' + dashedNode.id + ': existing=' + existingLevel + ', minDepth=' + dashedNode.minDepth + ', final=' + finalLevel);
                }
                nodeLevel.set(dashedNode.id, finalLevel);
            });

            // 階層レベルごとにノードを分類
            const levels = [];
            const allNodes = [...nodes, ...dashedNodesParam];
            const maxLevel = Math.max(...Array.from(nodeLevel.values()), 0);

            for (let i = 0; i <= maxLevel; i++) {
                const levelNodes = [];
                nodeLevel.forEach((level, nodeId) => {
                    if (level === i) {
                        const node = allNodes.find(n => n.id === nodeId);
                        if (node) {
                            levelNodes.push(node);
                        }
                    }
                });
                if (levelNodes.length > 0) {
                    levels.push(levelNodes);
                }
            }

            return { rootNodes, levels, childrenMap };
        }
    `;
}

module.exports = {
    getTreeStructureAnalyzer
};