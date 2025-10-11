function getHorizontalLayout() {
    return `
        function horizontalLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure) {
            return layoutNodesWithAxis(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure, false);
        }
    `;
}

module.exports = {
    getHorizontalLayout
};
