function validateTreeStructure(nodes, connections) {
    // 入力検証
    if (!nodes || !Array.isArray(nodes)) {
        return {
            isValid: false,
            errors: ['Invalid nodes: must be an array'],
            backEdges: []
        };
    }
    if (!connections || !Array.isArray(connections)) {
        return {
            isValid: false,
            errors: ['Invalid connections: must be an array'],
            backEdges: []
        };
    }

    const errors = [];
    const backEdges = [];

    // Mermaidの点線エッジは自動的にバックエッジとして扱う
    const dashedEdges = connections.filter(conn => conn.isDashed);
    backEdges.push(...dashedEdges.map(({ from, to }) => ({ from, to })));

    // 点線エッジを除外した通常のエッジのみでマップを構築
    const regularConnections = connections.filter(conn => !conn.isDashed);

    // 子ノードマップを構築（通常のエッジのみ）
    const childrenMap = new Map();
    nodes.forEach(node => {
        if (node && node.id !== undefined) {
            childrenMap.set(node.id, []);
        }
    });
    regularConnections.forEach(conn => {
        if (conn && conn.from !== undefined && childrenMap.has(conn.from)) {
            childrenMap.get(conn.from).push(conn.to);
        }
    });

    // DFS方式でバックエッジを検出
    const visited = new Set();
    const recStack = new Set();

    function dfs(nodeId) {
        visited.add(nodeId);
        recStack.add(nodeId);

        const children = childrenMap.get(nodeId) || [];
        for (const childId of children) {
            if (recStack.has(childId)) {
                // 訪問中のノードへのエッジ = バックエッジ
                backEdges.push({ from: nodeId, to: childId });
            } else if (!visited.has(childId)) {
                dfs(childId);
            }
        }

        recStack.delete(nodeId);
    }

    // 全ノードから開始（複数ルートに対応）
    nodes.forEach(node => {
        if (node && node.id !== undefined && !visited.has(node.id)) {
            dfs(node.id);
        }
    });

    return {
        isValid: true, // バックエッジがあっても描画可能
        errors: errors,
        backEdges: backEdges
    };
}

module.exports = {
    validateTreeStructure
};