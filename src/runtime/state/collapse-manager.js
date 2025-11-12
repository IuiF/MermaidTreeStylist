function getCollapseManager() {
    return `
        const collapseManager = {
            collapsedNodes: new Set(),
            childrenMap: new Map(),

            init: function() {
                allConnections.forEach(conn => {
                    if (!this.childrenMap.has(conn.from)) {
                        this.childrenMap.set(conn.from, []);
                    }
                    this.childrenMap.get(conn.from).push(conn.to);
                });
            },

            isCollapsed: function(nodeId) {
                return this.collapsedNodes.has(nodeId);
            },

            canCollapse: function(nodeId) {
                return this.childrenMap.has(nodeId) && this.childrenMap.get(nodeId).length > 0;
            },

            setNodeState: function(nodeId, collapsed) {
                const nodeElement = svgHelpers.getNodeElement(nodeId);
                const collapseButton = Array.from(nodeElement.children).find(el =>
                    el.classList && el.classList.contains('collapse-button')
                );

                if (collapsed) {
                    this.collapsedNodes.add(nodeId);
                    nodeElement.classList.add('collapsed-node');
                    shadowManager.add(nodeElement);
                    if (collapseButton) collapseButton.textContent = '▲';
                } else {
                    this.collapsedNodes.delete(nodeId);
                    nodeElement.classList.remove('collapsed-node');
                    shadowManager.remove(nodeElement);
                    if (collapseButton) collapseButton.textContent = '▼';
                }
            },

            recalculateLayout: function() {
                if (window.DEBUG_CONNECTIONS) {
                    console.log('recalculateLayout called');
                }
                requestAnimationFrame(() => {
                    // 可視性を先に更新してから再描画
                    this.updateVisibility();

                    currentNodePositions = redrawHelpers.recalculateLayout(currentLayout);

                    if (window.DEBUG_CONNECTIONS) {
                        console.log('Calling createCSSLines with ' + allConnections.length + ' connections');
                    }
                    redrawHelpers.redrawConnectionsWithHighlights(allConnections, currentNodePositions);
                    shadowManager.updatePositions(this.collapsedNodes);

                    // 座標を更新
                    redrawHelpers.updateViewport({ fitToContent: false });
                });
            },

            toggleCollapse: function(nodeId) {
                if (this.canCollapse(nodeId)) {
                    this.setNodeState(nodeId, !this.isCollapsed(nodeId));
                    this.updateVisibility();
                    this.recalculateLayout();
                }
            },

            isVisible: function(nodeId) {
                const isRoot = !allConnections.some(conn => conn.to === nodeId);
                if (isRoot) return true;

                // 複数の親を取得
                const parentConnections = allConnections.filter(conn => conn.to === nodeId);
                if (parentConnections.length === 0) return true;

                // すべての親が折りたたまれているか、または非表示の場合のみ非表示
                // どれか一つでも表示されている親があれば表示
                const hasVisibleParent = parentConnections.some(conn => {
                    if (!this.isCollapsed(conn.from)) {
                        return this.isVisible(conn.from);
                    }
                    return false;
                });

                return hasVisibleParent;
            },

            isEdgeVisible: function(connection) {
                // fromノードが折りたたまれている場合、エッジは非表示
                if (this.isCollapsed(connection.from)) {
                    return false;
                }
                // fromノードが非表示の場合、エッジは非表示
                if (!this.isVisible(connection.from)) {
                    return false;
                }
                // toノードが非表示の場合、エッジは非表示
                if (!this.isVisible(connection.to)) {
                    return false;
                }
                return true;
            },

            updateVisibility: function() {
                const edgeLayer = svgHelpers.getEdgeLayer();

                // ノードの可視性を更新
                allNodes.forEach(node => {
                    const element = svgHelpers.getNodeElement(node.id);
                    if (element) {
                        const visible = this.isVisible(node.id);
                        if (window.DEBUG_CONNECTIONS && node.isDashed) {
                            console.log('Visibility check for dashed node ' + node.id + ': ' + visible);
                        }
                        if (visible) {
                            element.classList.remove('hidden');
                        } else {
                            element.classList.add('hidden');
                        }
                    }

                    if (edgeLayer) {
                        const shadowElement = edgeLayer.querySelector(\`[data-shadow-for="\${node.id}"]\`);
                        if (shadowElement) {
                            if (this.isVisible(node.id)) {
                                shadowElement.classList.remove('hidden');
                            } else {
                                shadowElement.classList.add('hidden');
                            }
                        }
                    }
                });

                // エッジの可視性を更新
                allConnections.forEach(conn => {
                    const visible = this.isEdgeVisible(conn);
                    const edgeElements = document.querySelectorAll(\`.connection-line[data-from="\${conn.from}"][data-to="\${conn.to}"], .connection-arrow[data-from="\${conn.from}"][data-to="\${conn.to}"], .connection-label[data-from="\${conn.from}"][data-to="\${conn.to}"]\`);

                    edgeElements.forEach(element => {
                        if (visible) {
                            element.classList.remove('hidden');
                        } else {
                            element.classList.add('hidden');
                        }
                    });
                });
            },

            applyToNodes: function(filterFn, collapsed) {
                let changed = false;
                allNodes.forEach(node => {
                    if (filterFn(node) && this.canCollapse(node.id) &&
                        this.isCollapsed(node.id) !== collapsed) {
                        this.setNodeState(node.id, collapsed);
                        changed = true;
                    }
                });

                if (changed) {
                    this.updateVisibility();
                    this.recalculateLayout();
                }
            },

            collapseAll: function() {
                this.applyToNodes(() => true, true);
            },

            expandAll: function() {
                this.applyToNodes(() => true, false);
            },

            collapseAllByLabel: function(label) {
                this.applyToNodes(node => node.label === label, true);
            },

            expandAllByLabel: function(label) {
                this.applyToNodes(node => node.label === label, false);
            }
        };

        function toggleNodeCollapse(nodeId) {
            collapseManager.toggleCollapse(nodeId);
        }

        function collapseAll() {
            collapseManager.collapseAll();
        }

        function expandAll() {
            collapseManager.expandAll();
        }
    `;
}

module.exports = {
    getCollapseManager
};