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

        // Find outgoing edges
        const outgoingEdges = edges.filter(e => e.source === node.id);

        if (outgoingEdges.length > 0) {
            // If strictly one unconditional edge, simplify
            if (outgoingEdges.length === 1 && (!outgoingEdges[0].label || outgoingEdges[0].label === '')) {
                // Determine 'next' based on structure. 
                // The user's sample uses 'action' object. 
                // We need to inject 'next' into 'action' if 'action' exists, 
                // or at root if there is no action object?
                // Looking at sample.yaml, 'next' is inside 'action'.
                if (item.action) {
                    item.action.next = outgoingEdges[0].target;
                } else {
                    // If no action object, maybe it's just next? 
                    // But sample has distinct structure. 
                    // Let's assume most nodes have action. 
                    // If not, we might need to conform to a specific schema.
                    // For now, let's put next at root if action doesn't exist, 
                    // or create action object if needed?
                    // Sample shows: 
                    // - id: ask_otp_code
                    //   action: ...

                    // If the node data has 'action' object, we put 'next' there.
                    item.next = outgoingEdges[0].target;
                }
            } else {
                // Multiple edges or conditional edge
                const nextSteps = outgoingEdges.map(edge => {
                    const label = edge.label as string;
                    if (label && label.trim().toLowerCase().startsWith('if ')) {
                        // Strip 'if ' from start
                        return {
                            if: label.replace(/^if\s+/i, '').trim(),
                            then: edge.target
                        };
                    } else if (label && label.trim().toLowerCase() === 'else') {
                        return {
                            else: edge.target
                        };
                    } else {
                        // Fallback/Default
                        // If logic is mixed, this might be tricky.
                        // Assuming raw label is the condition if not explicitly 'else'
                        // But if label is empty?
                        if (!label) return { then: edge.target };
                        return { if: label, then: edge.target };
                    }
                });

                if (item.action) {
                    item.action.next = nextSteps;
                } else {
                    item.next = nextSteps; // Fallback
                }
            }
        }

        // If data has nested action which was flattened or manipulated, ensure structure.
        // My transformYamlToFlow put 'action' properties into node.data.action

        return item;
    });

    // Convert slots array to YAML object format
    const slotsObj: any = {};
    if (slots && slots.length > 0) {
        slots.forEach(slot => {
            slotsObj[slot.name] = {
                type: slot.type,
                description: slot.description,
                source: slot.source
            };
        });
    }

    // Return with slots if they exist
    if (Object.keys(slotsObj).length > 0) {
        return { slots: slotsObj, steps: yamlStructure };
    }

    return yamlStructure;
};
