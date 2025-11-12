function getBaseTemplate() {
    return {
        css: `        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            overflow: hidden;
            touch-action: none;
        }
        .tree-container {
            position: fixed;
            top: 60px;
            left: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
            background: #fafafa;
            cursor: grab;
            touch-action: none;
            overscroll-behavior: none;
        }
        .tree-container:active {
            cursor: grabbing;
        }
        #svgCanvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        #contentWrapper {
            position: absolute;
            top: 0;
            left: 0;
            transform-origin: 0 0;
            transform: translateZ(0);
            will-change: transform;
            pointer-events: none;
        }
        .node {
            cursor: pointer;
            pointer-events: all;
        }
        .node-rect {
            fill: #f9f9f9;
            stroke: #333;
            stroke-width: 2;
        }
        .node-text {
            fill: #333;
            font-size: 12px;
            font-family: Arial, sans-serif;
            pointer-events: none;
        }
        .collapse-button {
            fill: #333;
            font-size: 10px;
            font-family: Arial, sans-serif;
            cursor: pointer;
            user-select: none;
            pointer-events: none;
        }
        .connection-line {
            stroke: #666;
            stroke-width: 2;
            fill: none;
        }
        .connection-arrow {
            fill: #666;
        }
        .connection-label {
            pointer-events: none;
        }
        .hidden {
            display: none;
        }
        .collapsed-node .node-rect {
        }
        .highlighted .node-rect {
            fill: #fff3cd;
            stroke: #ffc107;
            filter: drop-shadow(0 0 8px rgba(255, 193, 7, 0.5));
        }
        .highlighted.collapsed-node .node-rect {
            fill: #fff3cd;
            stroke: #ffc107;
        }
        .path-highlighted .node-rect {
            fill: #e3f2fd;
            stroke: #2196f3;
            filter: drop-shadow(0 0 8px rgba(33, 150, 243, 0.5));
        }
        .path-highlighted.collapsed-node .node-rect {
            fill: #e3f2fd;
            stroke: #2196f3;
        }
        .highlighted.path-highlighted .node-rect {
            fill: #e3f2fd;
            stroke: #2196f3;
            filter: drop-shadow(0 0 8px rgba(33, 150, 243, 0.5)) drop-shadow(0 0 4px rgba(255, 193, 7, 0.8));
        }
        .highlighted.path-highlighted.collapsed-node .node-rect {
            fill: #e3f2fd;
            stroke: #2196f3;
        }
        .path-highlighted-line {
            stroke: #2196f3 !important;
        }
        .path-highlighted-line.connection-arrow {
            fill: #2196f3 !important;
        }
        .highlighted-line {
            stroke: #ffc107 !important;
        }
        .highlighted-line.connection-arrow {
            fill: #ffc107 !important;
        }
        .path-highlighted-line.highlighted-line {
            stroke: #2196f3 !important;
            stroke-width: 4;
            filter: drop-shadow(0 0 2px #ffc107);
        }
        .path-highlighted-line.highlighted-line.connection-arrow {
            fill: #2196f3 !important;
            filter: drop-shadow(0 0 2px #ffc107);
        }
        .relation-target .node-rect {
            fill: #ffe0b2;
            stroke: #ff9800;
            stroke-width: 3;
            filter: drop-shadow(0 0 8px rgba(255, 152, 0, 0.5));
        }
        .relation-parent .node-rect {
            fill: #e3f2fd;
            stroke: #2196f3;
            stroke-width: 2;
            filter: drop-shadow(0 0 6px rgba(33, 150, 243, 0.4));
        }
        .relation-child .node-rect {
            fill: #e8f5e9;
            stroke: #4caf50;
            stroke-width: 2;
            filter: drop-shadow(0 0 6px rgba(76, 175, 80, 0.4));
        }
        .relation-edge-highlighted {
            stroke: #f44336 !important;
            stroke-width: 3 !important;
            filter: drop-shadow(0 0 4px rgba(244, 67, 54, 0.6));
        }
        .relation-edge-highlighted.connection-arrow {
            fill: #f44336 !important;
        }
        .layout-controls {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #fff;
            padding: 10px;
            border-bottom: 1px solid #ddd;
            z-index: 1000;
            display: flex;
            align-items: flex-start;
            gap: 16px;
        }
        .button-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .layout-button {
            padding: 6px 12px;
            border: 1px solid #666;
            background: #f0f0f0;
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
            min-width: 120px;
            text-align: center;
        }
        .layout-button:hover {
            background: #e0e0e0;
        }
        .layout-button.active {
            background: #333;
            color: #fff;
        }
        .viewport-info {
            margin-left: auto;
            font-size: 11px;
            color: #666;
            align-self: center;
        }
        .context-menu {
            position: fixed;
            background: #fff;
            border: 1px solid #999;
            border-radius: 3px;
            box-shadow: 2px 2px 8px rgba(0,0,0,0.2);
            padding: 4px 0;
            z-index: 10000;
            display: none;
        }
        .context-menu.visible {
            display: block;
        }
        .context-menu-item {
            padding: 8px 16px;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
        }
        .context-menu-item:hover {
            background: #f0f0f0;
        }
        .context-menu-separator {
            height: 1px;
            background: #ddd;
            margin: 4px 0;
        }`,

        htmlStructure: {
            doctype: '<!DOCTYPE html>',
            htmlOpen: '<html>',
            headOpen: '<head>',
            title: '<title>Mermaid Tree</title>',
            headClose: '</head>',
            bodyOpen: '<body>',
            pageTitle: '<h1>Tree Structure</h1>',
            layoutControls: '<div class="layout-controls"><div class="button-group"><button class="layout-button" onclick="collapseAll()">すべて折りたたむ</button><button class="layout-button" onclick="expandAll()">すべて展開</button></div><div class="button-group"><button class="layout-button" id="straightLineBtn" onclick="toggleConnectionLineStyle()">直線</button><button class="layout-button active" id="curvedLineBtn" onclick="toggleConnectionLineStyle()">曲線</button></div><div class="button-group"><button class="layout-button" onclick="viewportManager.resetView()">位置リセット</button><button class="layout-button" onclick="viewportManager.fitToView()">全体表示</button></div><span class="viewport-info">ドラッグで移動 | ホイールで拡大縮小</span></div>',
            containerOpen: '<div class="tree-container" id="treeContainer"><svg id="svgCanvas"><g id="edgeLayer"></g><g id="nodeLayer"></g></svg><div id="contentWrapper">',
            containerClose: '</div></div>',
            bodyClose: '</body>',
            htmlClose: '</html>'
        }
    };
}

module.exports = {
    getBaseTemplate
};
