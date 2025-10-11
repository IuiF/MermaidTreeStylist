function getHorizontalLayout() {
    return `
        function horizontalLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure) {
            const container = document.getElementById('treeContainer');
            if (!container) {
                console.error('treeContainer element not found');
                return new Map();
            }
            let containerHeight = Math.max(LAYOUT_CONSTANTS.CONTAINER_DEFAULT, container.clientHeight || LAYOUT_CONSTANTS.CONTAINER_DEFAULT);

            const nodeWidthMap = calculateAllNodeWidths(nodes);
            const treeStructure = analyzeTreeStructure(nodes, connections);
            const nodePositions = new Map();

            const leftMargin = LAYOUT_CONSTANTS.LEFT_MARGIN;
            const topMargin = LAYOUT_CONSTANTS.TOP_MARGIN;
            const baseSpacing = LAYOUT_CONSTANTS.BASE_SPACING;
            const edgeClearance = LAYOUT_CONSTANTS.EDGE_CLEARANCE;
            const minLevelSpacing = LAYOUT_CONSTANTS.MIN_LEVEL_SPACING;

            // 各階層の最大ノード幅を事前に計算
            const levelMaxWidths = [];
            treeStructure.levels.forEach((level, levelIndex) => {
                let maxWidth = 0;
                level.forEach(node => {
                    const element = document.getElementById(node.id);
                    if (element && !element.classList.contains('hidden')) {
                        const dimensions = svgHelpers.getNodeDimensions(element);
                        maxWidth = Math.max(maxWidth, dimensions.width);
                    }
                });
                levelMaxWidths[levelIndex] = maxWidth;
            });

            // 各階層間の必要な距離を動的に計算
            const levelSpacings = [];
            for (let i = 0; i < treeStructure.levels.length - 1; i++) {
                const fromLevel = treeStructure.levels[i];
                const toLevel = treeStructure.levels[i + 1];
                levelSpacings[i] = calculateLevelSpacing(fromLevel, toLevel, connections, i, i + 1, treeStructure.levels);
            }

            // 各階層のX座標を計算
            const levelXPositions = [leftMargin];
            for (let i = 1; i < treeStructure.levels.length; i++) {
                const spacing = Math.max(levelSpacings[i - 1] || minLevelSpacing, minLevelSpacing);
                levelXPositions[i] = levelXPositions[i - 1] + levelMaxWidths[i - 1] + spacing + edgeClearance;
            }

            treeStructure.levels.forEach((level, levelIndex) => {
                const levelX = levelXPositions[levelIndex];
                let currentY = topMargin;

                level.forEach(node => {
                    const element = document.getElementById(node.id);
                    if (element && !element.classList.contains('hidden')) {
                        const parents = connections.filter(conn => conn.to === node.id).map(conn => conn.from);

                        if (parents.length > 0) {
                            let selectedParent = null;
                            let minResultY = Infinity;

                            for (const parentId of parents) {
                                if (nodePositions.has(parentId)) {
                                    const parentPos = nodePositions.get(parentId);
                                    const siblings = connections.filter(conn => conn.from === parentId).map(conn => conn.to);
                                    const nodeSpacing = calculateNodeSpacing(node.id, connections, false);

                                    let candidateY = parentPos.y;

                                    siblings.forEach(siblingId => {
                                        if (siblingId !== node.id && nodePositions.has(siblingId)) {
                                            const siblingPos = nodePositions.get(siblingId);
                                            const siblingSpacing = calculateNodeSpacing(siblingId, connections, false);
                                            candidateY = Math.max(candidateY, siblingPos.y + siblingPos.height + siblingSpacing);
                                        }
                                    });

                                    candidateY = Math.max(candidateY, currentY);

                                    if (candidateY < minResultY) {
                                        minResultY = candidateY;
                                        selectedParent = parentId;
                                    }
                                }
                            }

                            if (selectedParent) {
                                const nodeSpacing = calculateNodeSpacing(node.id, connections, false);

                                setNodePosition(element, levelX, minResultY);
                                const dimensions = svgHelpers.getNodeDimensions(element);
                                nodePositions.set(node.id, { x: levelX, y: minResultY, width: dimensions.width, height: dimensions.height });

                                currentY = Math.max(currentY, minResultY + dimensions.height + nodeSpacing);
                            } else {
                                const nodeSpacing = calculateNodeSpacing(node.id, connections, false);
                                setNodePosition(element, levelX, currentY);
                                const dimensions = svgHelpers.getNodeDimensions(element);
                                nodePositions.set(node.id, { x: levelX, y: currentY, width: dimensions.width, height: dimensions.height });
                                currentY += dimensions.height + nodeSpacing;
                            }
                        } else {
                            const nodeSpacing = calculateNodeSpacing(node.id, connections, false);
                            setNodePosition(element, levelX, currentY);
                            const dimensions = svgHelpers.getNodeDimensions(element);
                            nodePositions.set(node.id, { x: levelX, y: currentY, width: dimensions.width, height: dimensions.height });
                            currentY += dimensions.height + nodeSpacing;
                        }
                    }
                });
            });

            // 共通モジュールを使用して衝突を解決
            resolveDashedNodeEdgeCollisions({
                treeStructure,
                nodePositions,
                connections,
                constants: LAYOUT_CONSTANTS,
                isVertical: false,
                setNodePosition
            });

            resolveSameLevelCollisions({
                treeStructure,
                nodePositions,
                connections,
                isVertical: false,
                setNodePosition,
                calculateNodeSpacing
            });

            resolveNodeLabelCollisions({
                treeStructure,
                nodePositions,
                connections,
                constants: LAYOUT_CONSTANTS,
                isVertical: false,
                setNodePosition
            });

            // コンテナサイズ調整（nodePositionsが空でない場合のみ）
            if (nodePositions.size > 0) {
                const maxY = Math.max(...Array.from(nodePositions.values()).map(pos => pos.y + pos.height));
                const maxX = Math.max(...Array.from(nodePositions.values()).map(pos => pos.x + pos.width));

                if (maxY + LAYOUT_CONSTANTS.CONTAINER_MARGIN > containerHeight) {
                    containerHeight = maxY + LAYOUT_CONSTANTS.CONTAINER_MARGIN;
                    container.style.height = containerHeight + 'px';
                }

                let containerWidth = Math.max(LAYOUT_CONSTANTS.CONTAINER_DEFAULT, container.clientWidth || LAYOUT_CONSTANTS.CONTAINER_DEFAULT);
                if (maxX + LAYOUT_CONSTANTS.CONTAINER_MARGIN > containerWidth) {
                    containerWidth = maxX + LAYOUT_CONSTANTS.CONTAINER_MARGIN;
                    container.style.width = containerWidth + 'px';
                }
            }

            // 階層情報をグローバルに保存（エッジレンダラーで使用）
            window.layoutLevelInfo = {
                levelXPositions: levelXPositions,
                levelMaxWidths: levelMaxWidths,
                levelCount: treeStructure.levels.length
            };

            return nodePositions;
        }
    `;
}

module.exports = {
    getHorizontalLayout
};
