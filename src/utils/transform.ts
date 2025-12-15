import { MarkerType, type Node, type Edge } from 'reactflow';

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

export const transformYamlToFlow = (data: any): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let yPos = 0;
    const xPos = 250;
    const gapY = 250; // Increased gap for better visibility

    let items: any[] = [];

    // Strategy: Find the 'steps' array. 
    // 1. If data is array, it might be the steps.
    // 2. If data is object, look for a key that contains { steps: [] }

    if (Array.isArray(data)) {
        items = data;
    } else if (typeof data === 'object' && data !== null) {
        // Check if root has 'steps'
        if (Array.isArray(data.steps)) {
            items = data.steps;
        } else {
            // Check deeper: keys -> value.steps
            const keys = Object.keys(data);
            for (const key of keys) {
                if (data[key] && Array.isArray(data[key].steps)) {
                    items = data[key].steps;
                    break;
                }
            }

            // Fallback: if still no items, try key mapping (previous logic)
            if (items.length === 0) {
                items = keys.map(key => {
                    const val = data[key];
                    if (typeof val === 'object' && val !== null) {
                        return { id: key, ...val };
                    }
                    return null;
                }).filter(i => i !== null);
            }
        }
    }

    // Helper to normalize keys and values
    const cleanStr = (s: string) => s ? s.trim() : s;

    const normalizeItem = (item: any) => {
        const newItem: any = {};

        Object.keys(item).forEach(key => {
            // Clean key (trim whitespace, handle potential copy-paste artifacts if simple)
            const cleanKeyChar = key.trim();
            // Map common Capitalized keys to lowercase standard
            const map: Record<string, string> = {
                'Action': 'action',
                'Next': 'next',
                'Utter': 'utter',
                'Collect': 'collect',
                'Description': 'description',
                'Rejections': 'rejections',
                'Id': 'id',
                'ID': 'id'
            };

            const normalizedKey = map[cleanKeyChar] || cleanKeyChar;

            // Clean value if string
            let val = item[key];
            if (typeof val === 'string') {
                val = val.trim();
            }
            // If it's the ID, ensure it's set
            newItem[normalizedKey] = val;
        });

        // Fallback for ID if finding fails or mixed case
        if (!newItem.id && item.id) newItem.id = item.id;

        return newItem;
    };

    const normalizedItems = items.map(normalizeItem);

    // Create a Set of available IDs for fast lookup (case insensitive logic?)
    const availableIds = new Set(normalizedItems.map(i => i.id));
    console.log('Available Node IDs:', Array.from(availableIds));

    normalizedItems.forEach((item) => {
        if (item.id) {
            nodes.push({
                id: item.id,
                type: 'default',
                position: { x: xPos, y: yPos },
                data: {
                    label: item.id,
                    ...item
                },
            });
            yPos += gapY;
        }
    });

    // Edge Generation
    normalizedItems.forEach((item) => {
        const sourceId = item.id;
        if (!sourceId) return;

        const addEdge = (target: string, label?: string, style?: any, data?: any) => {
            const cleanTarget = cleanStr(target);
            // Check against available IDs
            if (availableIds.has(cleanTarget)) {
                edges.push({
                    id: `e-${sourceId}-${cleanTarget}-${edges.length}`,
                    source: sourceId,
                    target: cleanTarget,
                    label: label,
                    type: 'default',
                    markerEnd: { type: MarkerType.ArrowClosed, color: style?.stroke || '#000' },
                    style: style || { stroke: '#333', strokeWidth: 2 },
                    data: data // Pass custom data to edge
                });
            } else {
                console.warn(`Edge dropped: Source ${sourceId} -> Target ${cleanTarget} (Target not found)`);
            }
        };

        // 1. Handle 'next'
        if (item.next) {
            // Debug specific node
            if (item.id === 'invalid_correction') {
                console.log('DEBUG: invalid_correction next field:', item.next);
            }

            if (typeof item.next === 'string') {
                addEdge(item.next);
            } else if (Array.isArray(item.next)) {
                item.next.forEach((rule: any) => {
                    // Normalize rule keys (If -> if, Then -> then, Else -> else)
                    const ifCond = rule.if || rule.If;
                    const thenTarget = rule.then || rule.Then;
                    const elseTarget = rule.else || rule.Else;

                    // Extract clear_slots if present
                    const clearSlotsData = {
                        clear_slots: rule.clear_slots || rule.clear_slot
                    };

                    if (thenTarget) {
                        const condition = ifCond ? `if ${ifCond}` : 'else';
                        addEdge(thenTarget, condition, undefined, clearSlotsData);
                    } else if (elseTarget) {
                        addEdge(elseTarget, 'else', undefined, clearSlotsData);
                    } else if (typeof rule === 'string') {
                        addEdge(rule);
                    }
                });
            }
        }

        // 2. Handle 'rejections'
        if (item.rejections && Array.isArray(item.rejections)) {
            item.rejections.forEach((rule: any) => {
                const nextTarget = rule.next || rule.Next;

                if (nextTarget) {
                    // Simplify label and use red color for rejection
                    addEdge(nextTarget, '');
                }
            });
        }
    });

    return { nodes, edges };
};
