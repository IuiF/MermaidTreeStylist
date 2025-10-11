function getLayoutHelpers() {
    return `
        function initializeLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure) {
            const container = document.getElementById('treeContainer');
            if (!container) {
                console.error('treeContainer element not found');
                return null;
            }

            const nodeWidthMap = calculateAllNodeWidths(nodes);
            const treeStructure = analyzeTreeStructure(nodes, connections);
            const nodePositions = new Map();

            return {
                container,
                nodeWidthMap,
                treeStructure,
                nodePositions
            };
        }

        function calculateLevelPositions(treeStructure, connections, minLevelSpacing, edgeClearance, startPosition) {
            const levelSpacings = [];
            for (let i = 0; i < treeStructure.levels.length - 1; i++) {
                const fromLevel = treeStructure.levels[i];
                const toLevel = treeStructure.levels[i + 1];
                levelSpacings[i] = calculateLevelSpacing(fromLevel, toLevel, connections, i, i + 1, treeStructure.levels);
            }

            const positions = [startPosition];
            for (let i = 1; i < treeStructure.levels.length; i++) {
                const spacing = Math.max(levelSpacings[i - 1] || minLevelSpacing, minLevelSpacing);
                positions[i] = positions[i - 1] + spacing + edgeClearance;
            }

            return positions;
        }

        function calculateLevelMaxDimensions(treeStructure, isVertical) {
            const maxDimensions = [];
            treeStructure.levels.forEach((level, levelIndex) => {
                let maxDim = 0;
                level.forEach(node => {
                    const element = document.getElementById(node.id);
                    if (element && !element.classList.contains('hidden')) {
                        const dimensions = svgHelpers.getNodeDimensions(element);
                        maxDim = Math.max(maxDim, isVertical ? dimensions.height : dimensions.width);
                    }
                });
                maxDimensions[levelIndex] = maxDim;
            });
            return maxDimensions;
        }

        function resolveAllCollisions(params) {
            const { treeStructure, nodePositions, connections, isVertical, setNodePosition, calculateNodeSpacing } = params;

            resolveEdgeNodeCollisions({
                treeStructure,
                nodePositions,
                connections,
                constants: LAYOUT_CONSTANTS,
                isVertical,
                setNodePosition
            });

            resolveDashedNodeEdgeCollisions({
                treeStructure,
                nodePositions,
                connections,
                constants: LAYOUT_CONSTANTS,
                isVertical,
                setNodePosition
            });

            resolveSameLevelCollisions({
                treeStructure,
                nodePositions,
                connections,
                isVertical,
                setNodePosition,
                calculateNodeSpacing
            });

            resolveNodeLabelCollisions({
                treeStructure,
                nodePositions,
                connections,
                constants: LAYOUT_CONSTANTS,
                isVertical,
                setNodePosition
            });
        }

        function findParentLevel(parentId, treeStructure) {
            for (let i = 0; i < treeStructure.levels.length; i++) {
                if (treeStructure.levels[i].some(n => n.id === parentId)) {
                    return i;
                }
            }
            return -1;
        }

        function getSiblings(parentId, connections) {
            return connections.filter(conn => conn.from === parentId).map(conn => conn.to);
        }

        function getParents(nodeId, connections) {
            return connections.filter(conn => conn.to === nodeId).map(conn => conn.from);
        }
    `;
}

module.exports = {
    getLayoutHelpers
};
