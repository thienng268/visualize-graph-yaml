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
            // Priority: Selected Slot > Rejections

            // Rejections (Purple)
            if (filters.rejections && data.rejections && Array.isArray(data.rejections) && data.rejections.length > 0) {
                style = {
                    ...style,
                    borderWidth: '3px',
                    borderColor: '#722ed1', // Purple
                    boxShadow: '0 0 10px rgba(114, 46, 209, 0.6)'
                };
            }

            // Selected Slot Highlighting (Cyan/Blue)
            if (filters.selectedSlot) {
                const slot = filters.selectedSlot;
                let matchesSlot = false;

                // Check 'collect'
                if (data.collect === slot) matchesSlot = true;

                // Check 'sets_slot' or 'set_slot' (can be string or in action)
                if (data.sets_slot === slot || data.set_slot === slot) matchesSlot = true;
                if (data.action) {
                    if (data.action.sets_slot === slot || data.action.set_slot === slot) matchesSlot = true;
                }

                // Check 'clear_slots' (can be string or array)
                const checkClear = (val: any) => {
                    if (typeof val === 'string') return val === slot;
                    if (Array.isArray(val)) return val.includes(slot);
                    return false;
                };

                if (checkClear(data.clear_slots) || checkClear(data.clear_slot)) matchesSlot = true;
                if (data.action && (checkClear(data.action.clear_slots) || checkClear(data.action.clear_slot))) matchesSlot = true;

                // Check next transitions for clear_slots
                if (data.next && Array.isArray(data.next)) {
                    if (data.next.some((rule: any) => checkClear(rule.clear_slots) || checkClear(rule.clear_slot))) {
                        matchesSlot = true;
                    }
                }

                if (matchesSlot) {
                    style = {
                        ...style,
                        borderWidth: '3px',
                        borderColor: '#fa8c16', // Orange as requested
                        boxShadow: '0 0 10px rgba(250, 140, 22, 0.6)'
                    };
                }
            }
            return { ...node, style };
        }));
        setEdges((eds) => eds.map((edge) => {
            let style = edge.style ? { ...edge.style } : { stroke: '#333', strokeWidth: 2 };
            let markerEnd = edge.markerEnd;
            // Reset to default if not highlighted
            // Default styling is usually { stroke: '#333', strokeWidth: 2 } defined in transform
            // But we need to be careful not to override rejection red edges
            // We can check if it was previously highlighted and reset, or just rebuild base style
            // Simpler: Set base style first. 
            // Rejection edges are red. Normal are #333.
            // We can infer base color from the edge type or label? 
            // transform.ts sets markerEnd color.
            // NOTE: To safely toggle highlight without losing base style (like rejection red),
            // we should ideally store base style. But for now, let's assume standard behavior.
            let isHighlighted = false;
            // Edge highlighting: if selectedSlot is cleared in edge
            if (filters.selectedSlot) {
                const slot = filters.selectedSlot;
                const checkClear = (val: any) => {
                    if (typeof val === 'string') return val === slot;
                    if (Array.isArray(val)) return val.includes(slot);
                    return false;
                };

                if (edge.data && (checkClear(edge.data.clear_slots) || checkClear(edge.data.clear_slot))) {
                    isHighlighted = true;
                }
            }

            if (isHighlighted) {
                style = {
                    ...style,
                    stroke: '#fa8c16', // Orange
                    strokeWidth: 3
                };
                markerEnd = {
                    type: MarkerType.ArrowClosed,
                    color: '#fa8c16' // Orange
                };
                // Force animation for highlighted edges? User didn't ask, but good for visibility. 
                // User said "lights up". Color is sufficient.
            } else {
                // Revert to original. 
                // If it was red (rejection), it should stay red?
                // transform.ts sets stroke in style.
                // This part is tricky if we don't know the original color.
                // However, we are re-mapping based on current state.
                // If we modify 'style' in place, we lose original.
                // Correct way: The 'edges' state holds the source of truth. 
                // But we are modifying it here! 
                // Actually, transform.ts creates the initial edges.
                // We should probably re-run formatting on the *original* edges, but we only have current edges.
                // Fix: Access the *original* color if possible. 
                // Or, if we see it is NOT highlighted, we set it back to default or red?
                // Let's assume default for now. Rejection edges have specific logic?
                // Rejection edges in transform.ts are just edges with empty label? 
                // No, they are regular edges now. 
                // User said "Rejection: if condition" previously, then hidden.
                // Let's rely on standard style reset to #333 or red if we can detect it.
                // Actually, simple way: properties panel might save data to edge using updateData.
                // To avoid complexity: simple check. If currently yellow (#faad14), reset to #333.
                // But wait, rejections might be red?
                // transform logic for rejection: addEdge(nextTarget, '', undefined, ...) -> undefined style -> default #333.
                // Wait, rejection edges were red before? User reverted them to normal.
                // "Modified (Latest): Reverted the color to the default black/grey"
                // So all edges are #333 by default! Great.
                if (style.stroke === '#faad14') {
                    style.stroke = '#333';
                    style.strokeWidth = 2;
                    if (typeof markerEnd === 'object') markerEnd.color = '#000'; // Default arrow color
                }
            }
            return { ...edge, style, markerEnd };
        }));
    }, [filters, nodes.length]); // Edges length should also be dependency?
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
        rootKey: 'flow'
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
            setFlowMetadata(metadata || { name: '', description: '', rootKey: 'flow' });
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
            data: { label: id, utter: 'New Utterance' },
        };
        setNodes((nds) => nds.concat(newNode));
    };
    const onExport = () => {
        const flowData = transformFlowToYaml(nodes, edges, slots);
        let validFlowData: any = flowData;
        // If we have metadata with a rootKey (e.g., flow_khoa_the), wrap the steps
        // flowData might be { slots: {...}, steps: [...] } or just [...]
        const hasSlots = flowData && typeof flowData === 'object' && 'slots' in flowData;
        const steps = hasSlots ? flowData.steps : flowData;
        const slotsData = hasSlots ? flowData.slots : undefined;

        if (flowMetadata.rootKey && flowMetadata.rootKey !== 'flow') {
            validFlowData = {
                ...(slotsData ? { slots: slotsData } : {}),
                [flowMetadata.rootKey]: {
                    name: flowMetadata.name,
                    description: flowMetadata.description,
                    steps
                }
            };
        } else if (flowMetadata.name || flowMetadata.description) {
            // If no specific root key but has metadata, wrap in generic 'flow' or mixed? 
            // Revert to simple steps if generic?
            // User sample implies wrapping is important.
            // Let's wrap in 'flow' if rootKey is default but fields exist
            validFlowData = {
                ...(slotsData ? { slots: slotsData } : {}),
                [flowMetadata.rootKey || 'flow']: {
                    name: flowMetadata.name,
                    description: flowMetadata.description,
                    steps
                }
            };
        } else if (hasSlots) {
            // No metadata but has slots
            validFlowData = {
                slots: slotsData,
                steps
            };
        }
        const yamlString = yaml.dump(validFlowData);
        const blob = new Blob([yamlString], { type: 'text/yaml' });
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
        </Layout>
    );
};