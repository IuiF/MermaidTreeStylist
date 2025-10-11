function getVerticalLayout() {
    return `
        function verticalLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure) {
            const layoutData = initializeLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure);
            if (!layoutData) return new Map();

            const { container, treeStructure, nodePositions } = layoutData;
            let containerWidth = Math.max(LAYOUT_CONSTANTS.CONTAINER_DEFAULT, container.clientWidth || LAYOUT_CONSTANTS.CONTAINER_DEFAULT);

            const leftMargin = LAYOUT_CONSTANTS.LEFT_MARGIN;
            const edgeClearance = LAYOUT_CONSTANTS.EDGE_CLEARANCE;
            const minLevelSpacing = LAYOUT_CONSTANTS.MIN_LEVEL_SPACING;

            const levelYPositions = calculateLevelPositions(treeStructure, connections, minLevelSpacing, edgeClearance, 50);

            treeStructure.levels.forEach((level, levelIndex) => {
                const y = levelYPositions[levelIndex];

                if (levelIndex === 0) {
                    let currentY = y;
                    level.forEach(node => {
                        const element = document.getElementById(node.id);
                        if (element && !element.classList.contains('hidden')) {
                            setNodePosition(element, leftMargin, currentY);
                            const dimensions = svgHelpers.getNodeDimensions(element);
                            nodePositions.set(node.id, { x: leftMargin, y: currentY, width: dimensions.width, height: dimensions.height });
                            const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                            currentY += dimensions.height + nodeSpacing;
                        }
                    });
                } else {
                    let levelMaxX = leftMargin;

                    level.forEach(node => {
                        const element = document.getElementById(node.id);
                        if (element && !element.classList.contains('hidden')) {
                            const parents = getParents(node.id, connections);

                            if (parents.length > 0) {
                                let selectedParent = null;
                                let minParentLevel = Infinity;
                                let maxParentX = -1;

                                for (const parentId of parents) {
                                    if (nodePositions.has(parentId)) {
                                        const parentLevel = findParentLevel(parentId, treeStructure);
                                        const parentPos = nodePositions.get(parentId);

                                        if (parentLevel < minParentLevel ||
                                            (parentLevel === minParentLevel && parentPos.x > maxParentX)) {
                                            minParentLevel = parentLevel;
                                            maxParentX = parentPos.x;
                                            selectedParent = parentId;
                                        }
                                    }
                                }

                                if (selectedParent) {
                                    const parentPos = nodePositions.get(selectedParent);
                                    const siblings = getSiblings(selectedParent, connections);

                                    const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                                    let startX = parents.length > 1
                                        ? parentPos.x + parentPos.width + nodeSpacing
                                        : parentPos.x;

                                    siblings.forEach(siblingId => {
                                        if (siblingId !== node.id && nodePositions.has(siblingId)) {
                                            const siblingPos = nodePositions.get(siblingId);
                                            const siblingSpacing = calculateNodeSpacing(siblingId, connections, true);
                                            startX = Math.max(startX, siblingPos.x + siblingPos.width + siblingSpacing);
                                        }
                                    });

                                    startX = Math.max(startX, levelMaxX);

                                    setNodePosition(element, startX, y);
                                    const dimensions = svgHelpers.getNodeDimensions(element);
                                    nodePositions.set(node.id, { x: startX, y: y, width: dimensions.width });

                                    levelMaxX = Math.max(levelMaxX, startX + dimensions.width + nodeSpacing);
                                } else {
                                    const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                                    setNodePosition(element, levelMaxX, y);
                                    const dimensions = svgHelpers.getNodeDimensions(element);
                                    nodePositions.set(node.id, { x: levelMaxX, y: y, width: dimensions.width });
                                    levelMaxX += dimensions.width + nodeSpacing;
                                }
                            } else {
                                const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                                setNodePosition(element, levelMaxX, y);
                                const dimensions = svgHelpers.getNodeDimensions(element);
                                nodePositions.set(node.id, { x: levelMaxX, y: y, width: dimensions.width });
                                levelMaxX += dimensions.width + nodeSpacing;
                            }
                        }
                    });
                }
            });

            resolveAllCollisions({
                treeStructure,
                nodePositions,
                connections,
                isVertical: true,
                setNodePosition,
                calculateNodeSpacing
            });

            const maxX = Math.max(...Array.from(nodePositions.values()).map(pos => pos.x + pos.width));
            if (maxX + LAYOUT_CONSTANTS.CONTAINER_MARGIN > containerWidth) {
                containerWidth = maxX + LAYOUT_CONSTANTS.CONTAINER_MARGIN;
                container.style.width = containerWidth + 'px';
            }

            const levelMaxHeights = calculateLevelMaxDimensions(treeStructure, true);

            // 階層情報をグローバルに保存（エッジレンダラーで使用）
            window.layoutLevelInfo = {
                levelYPositions: levelYPositions,
                levelMaxHeights: levelMaxHeights,
                levelCount: treeStructure.levels.length,
                isVertical: true
            };

            return nodePositions;
        }
    `;
}

module.exports = {
    getVerticalLayout
};
