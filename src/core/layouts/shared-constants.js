function getLayoutConstants() {
    return `
        const LAYOUT_CONSTANTS = {
            CONTAINER_DEFAULT: 800,
            CONTAINER_MARGIN: 100,
            LEFT_MARGIN: 50,
            TOP_MARGIN: 50,
            BASE_SPACING: 60,
            EDGE_CLEARANCE: 80,
            MIN_LEVEL_SPACING: 120,
            COLLISION_MARGIN: 20,
            COLLISION_MAX_ITERATIONS: 10,
            DASHED_NODE_MAX_ITERATIONS: 5,
            LONG_DISTANCE_THRESHOLD: 3,
            LABEL_COLLISION_MARGIN: 5,
            LABEL_MAX_ITERATIONS: 5,
            LABEL_ESTIMATED_HEIGHT: 20,
            LABEL_VERTICAL_SPACING: 10,
            LABEL_TOP_MARGIN: 5,
            LABEL_ESTIMATED_WIDTH: 100
        };
    `;
}

module.exports = {
    getLayoutConstants
};
