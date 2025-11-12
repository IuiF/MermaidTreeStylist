function getLayoutSwitcher() {
    return `
        // Layout state
        let currentLayout = 'horizontal';
        let currentNodePositions = null;

        function switchLayout(layoutType) {
            currentLayout = layoutType;

            // Apply layout
            currentNodePositions = redrawHelpers.recalculateLayout(layoutType);

            // Redraw lines
            requestAnimationFrame(() => {
                redrawHelpers.redrawConnectionsWithHighlights(allConnections, currentNodePositions);

                // レイアウト変更後、座標を更新してコンテンツ全体が見えるように位置を調整
                redrawHelpers.updateViewport({ fitToContent: true });
            });
        }

        function toggleConnectionLineStyle() {
            const isCurved = toggleLineStyle();

            // Update button states
            document.getElementById('straightLineBtn').classList.toggle('active', !isCurved);
            document.getElementById('curvedLineBtn').classList.toggle('active', isCurved);

            // Redraw lines
            requestAnimationFrame(() => {
                redrawHelpers.redrawConnectionsWithHighlights(allConnections, currentNodePositions);
            });
        }
    `;
}

module.exports = {
    getLayoutSwitcher
};