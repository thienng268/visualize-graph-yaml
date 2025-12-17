import { type Node, type Edge } from 'reactflow';
import type { SlotDefinition } from './transform';

export const transformFlowToYaml = (nodes: Node[], edges: Edge[], slots?: SlotDefinition[]) => {
    const yamlStructure = nodes.map((node) => {
        // Base node structure
        const item: any = {
            id: node.id,
            ...node.data
        };

        // Remove internal properties we don't want in YAML
        delete item.label;

        // Ensure clear_slots is an array if it exists as a string
        if (item.clear_slots) {
            if (typeof item.clear_slots === 'string') {
                // Try to parse if it looks like JSON array
                if (item.clear_slots.trim().startsWith('[') && item.clear_slots.trim().endsWith(']')) {
                    try {
                        // Replace single quotes with double quotes for valid JSON parsing if needed
                        // Be careful with this replacement. Simple approach:
                        // If user wrote [slot1, slot2], we might need to conform.
                        // However, let's assume valid JSON or simple comma list wrapped in brackets.
                        // Basic fallback: remove brackets and split by comma
                        const content = item.clear_slots.replace(/^\[|\]$/g, '');
                        if (content.trim() === '') {
                            item.clear_slots = [];
                        } else {
                            item.clear_slots = content.split(',').map((s: string) => s.trim().replace(/^['"]|['"]$/g, ''));
                        }
                    } catch (e) {
                        // Keep as is if parsing fails, or force empty array?
                        // Let's keep as is, but user requested 'alf clears_slot: []' format.
                        // If it fails, maybe it's just a string?
                        // But best to try to return array.
                    }
                } else {
                    // If just a string "slot1", wrap in array
                    item.clear_slots = [item.clear_slots];
                }
            }
        }

        // Convert clear_slots to string representation [a, b] for FlowEditor quoting fix
        if (item.clear_slots && Array.isArray(item.clear_slots)) {
            item.clear_slots = `[${item.clear_slots.join(', ')}]`;
        }

        // Find outgoing edges
        const outgoingEdges = edges.filter(e => e.source === node.id);

        // Filter out edges that are already covered by rejections
        // This prevents duplicate "then" entries for invalid loops
        let effectiveEdges = outgoingEdges;
        if (item.rejections && Array.isArray(item.rejections)) {
            // Get all rejection targets
            const rejectionTargets = new Set(item.rejections.map((r: any) => r.next || r.Next));
            effectiveEdges = outgoingEdges.filter(e => !rejectionTargets.has(e.target));
        }

        if (effectiveEdges.length > 0) {
            // If strictly one unconditional edge, simplify
            // Check if edge has clear_slots data - if so, we can't simplify to string
            const firstEdge = effectiveEdges[0];
            const hasEdgeData = firstEdge.data && (firstEdge.data.clear_slots || firstEdge.data.clear_slot);

            if (effectiveEdges.length === 1 && (!firstEdge.label || firstEdge.label === '') && !hasEdgeData) {
                // Match the requested structure: next is a sibling of action, not inside it.
                item.next = firstEdge.target;
            } else {
                // Multiple edges or conditional edge or edge with data
                const nextSteps = effectiveEdges.map(edge => {
                    const label = edge.label as string;
                    let stepObj: any = {};

                    // 1. Condition
                    if (label && label.trim().toLowerCase().startsWith('if ')) {
                        stepObj.if = label.replace(/^if\s+/i, '').trim();
                    } else if (label && label.trim().toLowerCase() === 'else') {
                        // Else key logic handled below for target
                    } else {
                        // Fallback/Default
                        if (label) stepObj.if = label;
                    }

                    // 2. Clear Slots (Insert Middle)
                    if (edge.data && (edge.data.clear_slots || edge.data.clear_slot)) {
                        let cs = edge.data.clear_slots || edge.data.clear_slot;
                        if (typeof cs === 'string') {
                            if (cs.trim().startsWith('[') && cs.trim().endsWith(']')) {
                                try {
                                    const content = cs.replace(/^\[|\]$/g, '');
                                    cs = content.split(',').map((s: string) => s.trim().replace(/^['"]|['"]$/g, ''));
                                } catch (e) { /* ignore */ }
                            } else {
                                cs = [cs];
                            }
                        }

                        if (Array.isArray(cs)) {
                            stepObj.clear_slots = `[${cs.join(', ')}]`;
                        } else {
                            stepObj.clear_slots = cs;
                        }
                    }

                    // 3. Target (Insert Last)
                    if (label && label.trim().toLowerCase() === 'else') {
                        stepObj.else = edge.target;
                    } else {
                        stepObj.then = edge.target;
                    }

                    return stepObj;
                });

                item.next = nextSteps;
            }
        }

        // If data has nested action which was flattened or manipulated, ensure structure.
        // My transformYamlToFlow put 'action' properties into node.data.action

        return item;
    });

    // Convert slots to list format (array of objects) as per Example 1
    const slotsList = slots ? slots.map(slot => ({
        name: slot.name,
        displayName: slot.displayName,
        type: slot.type,
        description: slot.description,
        // Include other properties if necessary, assuming source might be one
        ...(slot.source ? { source: slot.source } : {})
    })) : [];

    // Return with slots if they exist
    if (slotsList.length > 0) {
        return { slots: slotsList, steps: yamlStructure };
    }

    return yamlStructure;
};
