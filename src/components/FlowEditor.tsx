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
import { transformYamlToFlow } from '../utils/transform';
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
  align-items: flex-end;
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
    width: 160px; /* Fixed width for uniformity */
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
        sets_slot: false,
        clear_slots: false // Plural as requested
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
            // Priority: Clear > Sets > Rejections (or cumulative? ReactFlow style is simple object)
            // If multiple filters match, the last one applied here "wins" the border color.

            // Rejections (Purple)
            if (filters.rejections && data.rejections && Array.isArray(data.rejections) && data.rejections.length > 0) {
                style = {
                    ...style,
                    borderWidth: '3px',
                    borderColor: '#722ed1', // Purple
                    boxShadow: '0 0 10px rgba(114, 46, 209, 0.6)'
                };
            }

            // Sets Slot (Green)
            if (filters.sets_slot) {
                if (data.sets_slot || data.set_slot || (data.action?.sets_slot) || (data.action?.set_slot)) {
                    style = {
                        ...style,
                        borderWidth: '3px',
                        borderColor: '#52c41a', // Green
                        boxShadow: '0 0 10px rgba(82, 196, 26, 0.6)'
                    };
                }
            }

            // Clear Slots (Orange)
            if (filters.clear_slots) {
                let hasClearSlots = false;
                if (data.clear_slots || data.clear_slot || (data.action?.clear_slots) || (data.action?.clear_slot)) {
                    hasClearSlots = true;
                }
                if (!hasClearSlots && data.next && Array.isArray(data.next)) {
                    hasClearSlots = data.next.some((rule: any) =>
                        rule.clear_slots || rule.clear_slot
                    );
                }

                if (hasClearSlots) {
                    style = {
                        ...style,
                        borderWidth: '3px',
                        borderColor: '#faad14', // Orange
                        boxShadow: '0 0 10px rgba(250, 173, 20, 0.6)'
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

            if (filters.clear_slots) {
                // Check edge data for clear_slots (passed from transform)
                // edge.data is generic, check existence
                if (edge.data && (edge.data.clear_slots || edge.data.clear_slot)) {
                    isHighlighted = true;
                }
            }

            if (isHighlighted) {
                style = {
                    ...style,
                    stroke: '#faad14',
                    strokeWidth: 3
                };
                markerEnd = {
                    type: MarkerType.ArrowClosed,
                    color: '#faad14'
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

    const handleFilterChange = (key: 'rejections' | 'sets_slot' | 'clear_slots') => {
        setFilters(prev => ({ ...prev, [key]: !prev[key] }));
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

    // Flow Metadata UI State
    const [isFlowInfoOpen, setIsFlowInfoOpen] = useState(false);

    const onPaneClick = useCallback(() => {
        setSelectedItem(null);
        setIsFlowInfoOpen(false); // Close panel on background click
    }, []);

    const handleYamlLoad = (data: any) => {
        console.log('YAML Loaded:', data);
        if (data) {
            const { nodes: flowNodes, edges: flowEdges, metadata } = transformYamlToFlow(data);

            // Apply Layout
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                flowNodes,
                flowEdges
            );

            console.log('Transformed Nodes:', layoutedNodes);
            console.log('Transformed Edges:', layoutedEdges);
            console.log('Extracted Metadata:', metadata);

            setFlowMetadata(metadata || { name: '', description: '', rootKey: 'flow' });
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
        const flowData = transformFlowToYaml(nodes, edges);

        let validFlowData: any = flowData;

        // If we have metadata with a rootKey (e.g., flow_khoa_the), wrap the steps
        if (flowMetadata.rootKey && flowMetadata.rootKey !== 'flow') {
            validFlowData = {
                [flowMetadata.rootKey]: {
                    name: flowMetadata.name,
                    description: flowMetadata.description,
                    steps: flowData
                }
            };
        } else if (flowMetadata.name || flowMetadata.description) {
            // If no specific root key but has metadata, wrap in generic 'flow' or mixed? 
            // Revert to simple steps if generic?
            // User sample implies wrapping is important.
            // Let's wrap in 'flow' if rootKey is default but fields exist
            validFlowData = {
                [flowMetadata.rootKey || 'flow']: {
                    name: flowMetadata.name,
                    description: flowMetadata.description,
                    steps: flowData
                }
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
            setNodes((nds) =>
                nds.map((node) => {
                    if (node.id === id) {
                        return { ...node, data: newData };
                    }
                    return node;
                })
            );
            setSelectedItem((prev: any) => prev ? { ...prev, data: newData } : null);
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

                <FilterPanel filters={filters} onFilterChange={handleFilterChange} />

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
            </FloatingControls>
        </Layout>
    );
};
