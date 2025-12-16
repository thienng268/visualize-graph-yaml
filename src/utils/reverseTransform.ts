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
                // Match the requested structure: next is a sibling of action, not inside it.
                item.next = outgoingEdges[0].target;
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
