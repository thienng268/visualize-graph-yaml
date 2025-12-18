import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
    addEdge,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    reconnectEdge,
    type OnConnect,
    type Connection,
    type Node,
    type Edge,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import styled from 'styled-components';
import yaml from 'js-yaml';
import { Upload } from './Upload';
import { PropertiesPanel } from './NodePanel';
import { FilterPanel } from './FilterPanel';
import { SlotsPanel } from './SlotsPanel';
import { transformYamlToFlow, type SlotDefinition } from '../utils/transform';
import { getLayoutedElements } from '../utils/layout';
import { transformFlowToYaml } from '../utils/reverseTransform';
import { CustomNode } from './CustomNode';
const nodeTypes = {
    custom: CustomNode,
};
const EditorContainer = styled.div`
  width: 100vw;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
  background: #fdfdfd;
  overflow: hidden; 
`;
const Layout = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
`;
const FloatingControls = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 5;
  align-items: stretch; /* Stretch to fill container for both-side alignment */
  pointer-events: none;
  
  & > * {
    pointer-events: auto;
  }
  h1 {
    font-size: 18px;
    color: #333;
    margin: 0 0 5px 0;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.9);
    padding: 6px 12px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    backdrop-filter: blur(4px);
  }
`;
const ControlButton = styled.button`
    background-color: #52c41a;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    box-sizing: border-box; /* Ensure padding is included in width */
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    /* width: 160px; Removed fixed width to allow stretch */
    text-align: center;
    
    &:hover {
        background-color: #73d13d;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.15);
    }
    &:active {
        transform: translateY(0);
    }
`;
export const FlowEditor: React.FC = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [itemType, setItemType] = useState<'node' | 'edge' | null>(null);
    const [rfInstance, setRfInstance] = useState<any>(null);
    const edgeReconnectSuccessful = useRef(false);
    // Filter State
    const [filters, setFilters] = useState({
        rejections: false,
        selectedSlot: ''
    });
    // Filter Logic Effect
    const [editingSlot, setEditingSlot] = useState<string | null>(null);

    React.useEffect(() => {
        setNodes((nds) => nds.map((node) => {
            const data = node.data;
            let style = {};
            // 1. Base Styles (End = Red, Action = Blue, Default = White)
            if (data.end === true) {
                style = {
                    ...style,
                    backgroundColor: '#ffccc7', // Light red background
                    borderColor: '#ff4d4f'
                };
            } else if (data.action && Object.keys(data.action).length > 0) {
                // Action Node (Light Blue)
                style = {
                    ...style,
                    backgroundColor: '#e6f7ff',
                    borderColor: '#1890ff'
                };
            }
            // 2. Filter Highlighting (Border Overrides)

            let isHighlighted = false;
            let highlightColor = '';

            // Rejections (Purple)
            if (filters.rejections && data.rejections && Array.isArray(data.rejections) && data.rejections.length > 0) {
                isHighlighted = true;
                highlightColor = '#722ed1'; // Purple
            }

            // Helper to check slot match and return type
            // Returns: 'set' | 'clear' | 'utter' | null
            // Priority: set > clear > utter
            const getSlotUsageType = (slotName: string): 'set' | 'clear' | 'utter' | null => {
                // Check 'collect' / 'sets_slot' (Blue)
                if (data.collect === slotName) return 'set';
                if (data.sets_slot === slotName || data.set_slot === slotName) return 'set';
                if (data.action) {
                    if (data.action.sets_slot === slotName || data.action.set_slot === slotName) return 'set';
                }

                // Check 'clear_slots' (Red)
                const checkClear = (val: any) => {
                    if (typeof val === 'string') return val === slotName;
                    if (Array.isArray(val)) return val.includes(slotName);
                    return false;
                };
                if (checkClear(data.clear_slots) || checkClear(data.clear_slot)) return 'clear';
                if (data.action && (checkClear(data.action.clear_slots) || checkClear(data.action.clear_slot))) return 'clear';

                // Check next transitions for clear_slots
                if (data.next && Array.isArray(data.next)) {
                    if (data.next.some((rule: any) => checkClear(rule.clear_slots) || checkClear(rule.clear_slot))) {
                        return 'clear';
                    }
                }

                // Check for slot usage in utterances (Orange)
                const slotPattern = `{${slotName}}`;
                if (data.utter && typeof data.utter === 'string' && data.utter.includes(slotPattern)) {
                    return 'utter';
                }
                if (data.action && data.action.utter && typeof data.action.utter === 'string' && data.action.utter.includes(slotPattern)) {
                    return 'utter';
                }

                return null;
            };

            // Selected Slot Highlighting - overrides Rejections
            if (filters.selectedSlot) {
                const usageType = getSlotUsageType(filters.selectedSlot);
                if (usageType) {
                    isHighlighted = true;
                    if (usageType === 'set') highlightColor = '#1890ff'; // Blue for collect/sets_slot
                    else if (usageType === 'clear') highlightColor = '#ff4d4f'; // Red for clear_slots
                    else highlightColor = '#fa8c16'; // Orange for utter
                }
            }

            // Editing Slot Highlighting (Green) - overrides everything
            if (editingSlot) {
                // For editing, we just check if it matches at all, we don't distinguish types for color (always green),
                // but we reuse the helper to check existence.
                if (getSlotUsageType(editingSlot)) {
                    isHighlighted = true;
                    highlightColor = '#52c41a'; // Green
                }
            }

            if (isHighlighted) {
                style = {
                    ...style,
                    borderWidth: '3px',
                    borderColor: highlightColor,
                    boxShadow: `0 0 10px ${highlightColor}99` // Add some opacity to shadow
                };
            }

            return { ...node, style };
        }));
        setEdges((eds) => eds.map((edge) => {
            let style = edge.style ? { ...edge.style } : { stroke: '#333', strokeWidth: 2 };
            let markerEnd = edge.markerEnd;
            let isHighlighted = false;
            let highlightColor = '';

            const checkSlotMatchEdge = (slotName: string) => {
                const checkClear = (val: any) => {
                    if (typeof val === 'string') return val === slotName;
                    if (Array.isArray(val)) return val.includes(slotName);
                    return false;
                };
                if (edge.data && (checkClear(edge.data.clear_slots) || checkClear(edge.data.clear_slot))) {
                    return true;
                }
                return false;
            }

            if (filters.selectedSlot && checkSlotMatchEdge(filters.selectedSlot)) {
                isHighlighted = true;
                highlightColor = '#fa8c16'; // Orange
            }

            if (editingSlot && checkSlotMatchEdge(editingSlot)) {
                isHighlighted = true;
                highlightColor = '#52c41a'; // Green
            }

            if (isHighlighted) {
                style = {
                    ...style,
                    stroke: highlightColor,
                    strokeWidth: 3
                };
                markerEnd = {
                    type: MarkerType.ArrowClosed,
                    color: highlightColor
                };
            } else {
                if (style.stroke === '#fa8c16' || style.stroke === '#52c41a') {
                    style.stroke = '#333';
                    style.strokeWidth = 2;
                    if (typeof markerEnd === 'object') markerEnd.color = '#000';
                }
            }
            return { ...edge, style, markerEnd };
        }));
    }, [filters, editingSlot, nodes.length]);
    // Added edges.length dependency or just filters?
    // If we load new YAML, setEdges is called, overwriting state. 
    // Effect runs because nodes.length likely changes. Good.
    const handleFilterChange = (key: 'rejections' | 'selectedSlot', value?: any) => {
        setFilters(prev => ({
            ...prev,
            [key]: value !== undefined ? value : !prev[key as 'rejections']
        }));
    };
    const onConnect: OnConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ ...params, type: 'default', markerEnd: { type: MarkerType.ArrowClosed, color: '#000' }, style: { stroke: '#333', strokeWidth: 2 } }, eds)),
        [setEdges]
    );
    const onReconnectStart = useCallback(() => {
        edgeReconnectSuccessful.current = false;
    }, []);
    const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
        edgeReconnectSuccessful.current = true;
        setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
    }, [setEdges]);
    const onReconnectEnd = useCallback((_: any, edge: Edge) => {
        if (!edgeReconnectSuccessful.current) {
            setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        }
        edgeReconnectSuccessful.current = true;
    }, [setEdges]);
    // Flow Metadata State
    const [flowMetadata, setFlowMetadata] = useState({
        name: '',
        description: '',
        id: ''
    });
    // Slots State
    const [slots, setSlots] = useState<SlotDefinition[]>([]);
    // Flow Metadata UI State
    const [isFlowInfoOpen, setIsFlowInfoOpen] = useState(false);
    const onPaneClick = useCallback(() => {
        setSelectedItem(null);
        setIsFlowInfoOpen(false); // Close panel on background click
    }, []);
    const handleYamlLoad = (data: any) => {
        console.log('YAML Loaded:', data);
        if (data) {
            const { nodes: flowNodes, edges: flowEdges, metadata, slots: extractedSlots } = transformYamlToFlow(data);
            // Apply Layout
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                flowNodes,
                flowEdges
            );
            console.log('Transformed Nodes:', layoutedNodes);
            console.log('Transformed Edges:', layoutedEdges);
            console.log('Extracted Metadata:', metadata);
            console.log('Extracted Slots:', extractedSlots);
            setFlowMetadata(metadata || { name: '', description: '', id: '' });
            setSlots(extractedSlots || []);
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
            setTimeout(() => {
                if (rfInstance) {
                    rfInstance.fitView();
                }
            }, 100);
        }
    };
    const onNodeClick = (_event: React.MouseEvent, node: Node) => {
        setSelectedItem(node);
        setItemType('node');
    };
    const onEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
        setSelectedItem(edge);
        setItemType('edge');
    };
    const onDeleteItem = () => {
        if (!selectedItem) return;
        if (itemType === 'node') {
            setNodes((nds) => nds.filter((n) => n.id !== selectedItem.id));
            setEdges((eds) => eds.filter((e) => e.source !== selectedItem.id && e.target !== selectedItem.id));
        } else {
            setEdges((eds) => eds.filter((e) => e.id !== selectedItem.id));
        }
        setSelectedItem(null);
        setItemType(null);
    }
    // Slot Handlers
    const onUpdateSlot = (index: number, updatedSlot: SlotDefinition) => {
        setSlots(prev => prev.map((slot, i) => i === index ? updatedSlot : slot));
    };
    const onAddSlot = () => {
        const newSlot: SlotDefinition = {
            name: `new_slot_${slots.length + 1}`,
            type: 'text',
            displayName: '',
            description: '',
            source: ''
        };
        setSlots(prev => [...prev, newSlot]);
    };
    const onDeleteSlot = (index: number) => {
        setSlots(prev => prev.filter((_, i) => i !== index));
    };
    const onAddNode = () => {
        const id = `new_node_${nodes.length + 1}`;
        const newNode: Node = {
            id,
            type: 'default',
            position: { x: 100, y: 100 },
            data: { label: id, utter: '' },
        };
        setNodes((nds) => nds.concat(newNode));
    };
    const onExport = () => {
        const flowData = transformFlowToYaml(nodes, edges, slots);
        let validFlowData: any = flowData;
        // If we have metadata with a rootKey (e.g., flow_khoa_the), wrap the steps
        // flowData might be { slots: {...}, steps: [...] } or just [...]
        const hasSlots = flowData && typeof flowData === 'object' && 'slots' in flowData;
        const steps = hasSlots ? (flowData as any).steps : flowData;
        const slotsData = hasSlots ? (flowData as any).slots : undefined;

        // Flat export without root key wrapper
        const flowContent: any = {
            id: flowMetadata.id,
            name: flowMetadata.name,
            description: flowMetadata.description,
            ...(slotsData ? { slots: slotsData } : {}),
            steps
        };
        if (!flowContent.id) delete flowContent.id;

        validFlowData = flowContent;

        // Dump without global double quotes to keep 'then', 'else', and step IDs clean
        const yamlString = yaml.dump(validFlowData, {
            lineWidth: -1,
            noCompatMode: true
        });

        // Post-process to apply specific formatting rules
        const quotedYaml = yamlString.split('\n').map(line => {
            const trimmedLine = line.trim();

            // 1. Force | instead of |- for multiline utter
            if (trimmedLine.startsWith('utter: |-')) {
                return line.replace('|-', '|');
            }

            // 2. Unquote clear_slots if it was quoted by yaml.dump (e.g. clear_slots: "[a, b]")
            // We want clear_slots: [a, b]
            const clearSlotsMatch = line.match(/^(\s*-?\s*)clear_slots:\s+(.+)$/);
            if (clearSlotsMatch) {
                const [_, prefix, value] = clearSlotsMatch;
                let val = value.trim();
                // Remove surrounding quotes if present
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                return `${prefix}clear_slots: ${val}`;
            }

            // 3. Selective Quoting for specific keys
            const keyMatch = line.match(/^(\s*-?\s*)(name|description|displayName|type|source|utter|id):\s+(.+)$/);
            if (keyMatch) {
                const [_, prefix, key, value] = keyMatch;
                const trimmedValue = value.trim();

                // Skip if block scalar
                if (trimmedValue.startsWith('|') || trimmedValue.startsWith('>')) return line;

                // Special Rule: ID
                // - id: value  <-- Step ID (List item) -> No quotes
                //   id: value  <-- Flow ID (Root/Metadata) -> No quotes (Indent < 6)
                //       id: value <-- Action ID (Nested) -> Quotes (Indent >= 6)
                if (key === 'id') {
                    // List item (Step ID) -> No quotes
                    if (prefix.includes('-')) return line;

                    // Root/Flow ID (Low indentation) -> No quotes
                    if (prefix.length < 6) return line;

                    // Otherwise (Action ID) -> Quote it
                }

                // Skip if already quoted with double quotes
                if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) return line;

                // Unwrap single quotes if present
                let content = trimmedValue;
                if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
                    content = trimmedValue.slice(1, -1).replace(/''/g, "'");
                }

                // Quote it
                const escapedContent = content.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                return `${prefix}${key}: "${escapedContent}"`;
            }

            return line;
        }).join('\n');

        const blob = new Blob([quotedYaml], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'workflow.yaml';
        document.body.appendChild(a); // Append to body
        a.click();
        document.body.removeChild(a); // Remove after click
        URL.revokeObjectURL(url);
    };
    // Callback to update data from the panel
    const updateData = (id: string, newData: any, type: 'node' | 'edge') => {
        if (type === 'node') {
            setNodes((nds) => {
                // Check if ID is being changed
                const newId = newData.id;
                if (newId && newId !== id) {
                    // Check for duplicate ID
                    if (nds.some(n => n.id === newId)) {
                        alert(`Node ID "${newId}" already exists. Please choose a unique ID.`);
                        return nds;
                    }

                    // Update edges first to point to new ID
                    setEdges(eds => eds.map(e => {
                        let updated = { ...e };
                        if (e.source === id) updated.source = newId;
                        if (e.target === id) updated.target = newId;
                        return updated;
                    }));

                    // Update the node
                    return nds.map((node) => {
                        if (node.id === id) {
                            return { ...node, id: newId, data: newData };
                        }
                        return node;
                    });
                }

                // Normal update (no ID change)
                return nds.map((node) => {
                    if (node.id === id) {
                        return { ...node, data: newData };
                    }
                    return node;
                });
            });

            // Update selected item if ID changed
            if (newData.id && newData.id !== id) {
                setSelectedItem((prev: any) => prev ? { ...prev, id: newData.id, data: newData } : null);
            } else {
                setSelectedItem((prev: any) => prev ? { ...prev, data: newData } : null);
            }
        } else {
            setEdges((eds) =>
                eds.map((edge) => {
                    if (edge.id === id) {
                        return {
                            ...edge,
                            label: newData.label,
                            data: newData.data // Update data (including clear_slots)
                        };
                    }
                    return edge;
                })
            );
            setSelectedItem((prev: any) => prev ? { ...prev, label: newData.label, data: newData.data } : null);
        }
    };
    return (
        <Layout>
            <EditorContainer>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onReconnect={onReconnect}
                    onReconnectStart={onReconnectStart}
                    onReconnectEnd={onReconnectEnd}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    onPaneClick={onPaneClick}
                    onInit={setRfInstance}
                    fitView
                    minZoom={0.1}
                >
                    <Controls />
                    <MiniMap />
                    <Background gap={12} size={1} />
                </ReactFlow>
                <SlotsPanel
                    slots={slots}
                    onUpdate={onUpdateSlot}
                    onAdd={onAddSlot}
                    onDelete={onDeleteSlot}
                    onSlotFocus={setEditingSlot}
                    activeSlot={editingSlot}
                />
                <PropertiesPanel
                    selectedItem={selectedItem}
                    itemType={itemType}
                    onUpdate={updateData}
                    onDelete={onDeleteItem}
                    onClose={() => {
                        setSelectedItem(null);
                        setIsFlowInfoOpen(false);
                    }}
                    flowMetadata={flowMetadata}
                    onMetadataUpdate={(newMeta) => setFlowMetadata(prev => ({ ...prev, ...newMeta }))}
                    isFlowInfoOpen={isFlowInfoOpen}
                    nodes={nodes}
                    edges={edges}
                    slots={slots}
                />
            </EditorContainer>
            <FloatingControls>
                <h1>Workflow Visualizer</h1>
                <div style={{ pointerEvents: 'auto' }}>
                    <Upload onLoad={handleYamlLoad} />
                </div>
                <ControlButton onClick={() => setIsFlowInfoOpen(true)}>Edit Flow Info</ControlButton>
                <ControlButton onClick={onAddNode}>+ Add Node</ControlButton>
                <ControlButton style={{ backgroundColor: '#1890ff' }} onClick={onExport}>Download YAML</ControlButton>
                <FilterPanel filters={filters} onFilterChange={handleFilterChange} slots={slots} />
            </FloatingControls>
        </Layout >
    );
};