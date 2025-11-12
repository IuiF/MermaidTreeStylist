function getRedrawHelpers() {
    return `
        const redrawHelpers = {
            /**
             * エッジを再描画し、すべてのハイライトを再適用
             * @param {Array} connections - 接続データ
             * @param {Object} nodePositions - ノード位置データ
             */
            redrawConnectionsWithHighlights: function(connections, nodePositions) {
                // V2のLayoutResultが存在する場合はそれを使用
                if (window.currentLayoutResult && window.currentLayoutResult.edgeRoutes) {
                    if (typeof renderFromLayoutResult === 'function') {
                        renderFromLayoutResult(window.currentLayoutResult, connections);
                    } else {
                        createCSSLines(connections, nodePositions);
                    }
                } else {
                    createCSSLines(connections, nodePositions);
                }
                pathHighlighter.reapplyPathHighlight();
                highlightManager.reapplyRelationHighlight();
            },

            /**
             * ビューポートの境界を更新
             * @param {Object} options - オプション
             * @param {boolean} options.fitToContent - コンテンツに合わせて表示するか (デフォルト: false)
             */
            updateViewport: function(options = {}) {
                const { fitToContent = false } = options;

                requestAnimationFrame(() => {
                    viewportManager.updateContentBounds();
                    if (fitToContent) {
                        viewportManager.fitToContent();
                    }
                });
            },

            /**
             * 現在のレイアウトモードでレイアウトを再計算
             * @param {string} layoutMode - 'horizontal' または 'vertical'
             * @returns {Object} ノード位置データ
             */
            recalculateLayout: function(layoutMode) {
                if (layoutMode === 'vertical') {
                    const layoutResult = verticalLayout(
                        allNodes,
                        connections,
                        calculateAllNodeWidths,
                        (n, c) => analyzeTreeStructure(n, c, dashedNodes)
                    );

                    // LayoutResultをグローバルに保存（後方互換性のため）
                    window.currentLayoutResult = layoutResult;

                    // nodePositionsを従来形式で返す
                    const nodePositions = layoutResult.nodePositions;
                    const nodePositionsObj = {};
                    nodePositions.forEach((pos, nodeId) => {
                        nodePositionsObj[nodeId] = pos;
                    });

                    return nodePositionsObj;
                }

                // horizontal layoutはV2システムを使用
                const nodeWidths = new Map();
                allNodes.forEach(node => {
                    const element = document.getElementById(node.id);
                    if (element) {
                        const width = parseInt(element.getAttribute('data-width')) || 0;
                        nodeWidths.set(node.id, width);
                    }
                });

                const dashedNodeSet = new Set();
                dashedNodes.forEach(node => {
                    dashedNodeSet.add(node.id);
                });

                const treeStructure = analyzeTreeStructure(allNodes, allConnections, dashedNodes);

                // 可視エッジのみをフィルタリング
                let visibleConnections = allConnections;
                if (typeof collapseManager !== 'undefined') {
                    visibleConnections = allConnections.filter(conn => collapseManager.isEdgeVisible(conn));
                }

                const input = {
                    nodes: allNodes,
                    connections: visibleConnections,
                    treeStructure: treeStructure,
                    nodeWidths: nodeWidths,
                    dashedNodes: dashedNodeSet
                };

                const layoutResult = v2LayoutEngine.calculateLayout(input);

                // LayoutResultをグローバルに保存（後方互換性のため）
                window.currentLayoutResult = layoutResult;

                const nodePositions = layoutResult.nodePositions;

                const nodePositionsObj = {};
                nodePositions.forEach((pos, nodeId) => {
                    nodePositionsObj[nodeId] = pos;
                });

                Object.keys(nodePositionsObj).forEach(nodeId => {
                    const element = document.getElementById(nodeId);
                    if (element) {
                        const pos = nodePositionsObj[nodeId];
                        element.setAttribute('transform', 'translate(' + pos.x + ',' + pos.y + ')');
                    }
                });

                return nodePositionsObj;
            }
        };
    `;
}

module.exports = {
    getRedrawHelpers
};
