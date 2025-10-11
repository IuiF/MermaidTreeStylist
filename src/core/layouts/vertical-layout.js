function getVerticalLayout() {
    return `
        function verticalLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure) {
            return layoutNodesWithAxis(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure, true);
        }
    `;
}

module.exports = {
    getVerticalLayout
};
