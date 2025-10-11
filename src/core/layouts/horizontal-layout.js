function getHorizontalLayout() {
    return `
        function horizontalLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure) {
            const layoutData = initializeLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure);
            if (!layoutData) return new Map();

            const { container, treeStructure, nodePositions } = layoutData;
            let containerHeight = Math.max(LAYOUT_CONSTANTS.CONTAINER_DEFAULT, container.clientHeight || LAYOUT_CONSTANTS.CONTAINER_DEFAULT);

            const leftMargin = LAYOUT_CONSTANTS.LEFT_MARGIN;
            const topMargin = LAYOUT_CONSTANTS.TOP_MARGIN;
            const edgeClearance = LAYOUT_CONSTANTS.EDGE_CLEARANCE;
            const minLevelSpacing = LAYOUT_CONSTANTS.MIN_LEVEL_SPACING;

            const levelMaxWidths = calculateLevelMaxDimensions(treeStructure, false);
            const levelSpacings = [];
            for (let i = 0; i < treeStructure.levels.length - 1; i++) {
                const fromLevel = treeStructure.levels[i];
                const toLevel = treeStructure.levels[i + 1];
                levelSpacings[i] = calculateLevelSpacing(fromLevel, toLevel, connections, i, i + 1, treeStructure.levels);
            }

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
                        const parents = getParents(node.id, connections);

                        if (parents.length > 0) {
                            let selectedParent = null;
                            let minResultY = Infinity;

                            for (const parentId of parents) {
                                if (nodePositions.has(parentId)) {
                                    const parentPos = nodePositions.get(parentId);
                                    const siblings = getSiblings(parentId, connections);
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

            resolveAllCollisions({
                treeStructure,
                nodePositions,
                connections,
                isVertical: false,
                setNodePosition,
                calculateNodeSpacing
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
