import { Node, Edge, MarkerType } from 'reactflow';

export interface YamlNodeData {
    id: string;
    action?: {
        id: string;
        description: string;
        utter: string;
        next?: any[];
    };
    // Add other potential fields
}

export const transformYamlToFlow = (yamlData: any[]): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let yPos = 0;
    const xPos = 250;
    const gapY = 200;

    yamlData.forEach((item, index) => {
        // Basic Node Creation
        if (item.id) {
            nodes.push({
                id: item.id,
                type: 'default', // Using default for now, can be custom
                position: { x: xPos, y: yPos },
                data: { label: item.id, ...item }, // Store full item data
            });
            yPos += gapY;
        }
    });

    // Second pass for edges to ensure all nodes exist (though simple sequential might suffice for now, the user example has conditionals)
    yamlData.forEach((item) => {
        if (item.action && item.action.next) {
            item.action.next.forEach((nextRule: any, idx: number) => {
                // Case 1: Simple string "next: ask_otp_code" (though example shows list of objects)
                // Case 2: Object with "if/else" logic

                if (typeof nextRule === 'string') {
                    // If the user used simple format (unlikely based on valid yaml but possible in some interpretations)
                } else if (typeof nextRule === 'object') {
                    if (nextRule.then) {
                        // Conditional edge
                        edges.push({
                            id: `e-${item.id}-${nextRule.then}-${idx}`,
                            source: item.id,
                            target: nextRule.then,
                            label: nextRule.if ? `if ${nextRule.if}` : 'else',
                            type: 'smoothstep',
                            markerEnd: { type: MarkerType.ArrowClosed },
                            animated: true,
                        });
                    } else if (nextRule.else) {
                        edges.push({
                            id: `e-${item.id}-${nextRule.else}-${idx}`,
                            source: item.id,
                            target: nextRule.else,
                            label: 'else',
                            type: 'smoothstep',
                            markerEnd: { type: MarkerType.ArrowClosed },
                        });
                    } else if (Object.keys(nextRule).length === 1 && typeof Object.values(nextRule)[0] === 'string') {
                        // unlikely structure from example but handling generic
                    }
                }
            });
        }
    });

    return { nodes, edges };
};
