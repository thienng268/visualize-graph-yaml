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

            // 1. Base 'end' style (Standard Red Background)
            if (data.end === true) {
                style = {
                    ...style,
                    backgroundColor: '#ffccc7', // Light red background
                    borderColor: '#ff4d4f'
                };
            }

            // 2. Filter Highlighting (Yellow Border/Glow)
            let isHighlighted = false;

            // Check Rejections
            if (filters.rejections && data.rejections && Array.isArray(data.rejections) && data.rejections.length > 0) {
                isHighlighted = true;
            }

            // Check sets_slot (Found in action details usually, or root data if simplified)
            // Checking both potential locations
            if (filters.sets_slot) {
                if (data.sets_slot || data.set_slot || (data.action?.sets_slot) || (data.action?.set_slot)) isHighlighted = true;
            }

            // Check clear_slots (plural as requested)
            if (filters.clear_slots) {
                if (data.clear_slots || data.clear_slot || (data.action?.clear_slots) || (data.action?.clear_slot)) isHighlighted = true;
            }

            if (isHighlighted) {
                style = {
                    ...style,
                    borderWidth: '3px',
                    borderColor: '#faad14', // Yellow/Orange highlight
                    boxShadow: '0 0 10px rgba(250, 173, 20, 0.6)'
                };
            }

            return { ...node, style };
        }));
    }, [filters, nodes.length]);

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

    const handleYamlLoad = (data: any) => {
        console.log('YAML Loaded:', data);
        if (data) {
            const { nodes: flowNodes, edges: flowEdges } = transformYamlToFlow(data);

            // Apply Layout
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                flowNodes,
                flowEdges
            );

            console.log('Transformed Nodes:', layoutedNodes);
            console.log('Transformed Edges:', layoutedEdges);
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

    const onPaneClick = () => {
        setSelectedItem(null);
        setItemType(null);
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
        const yamlObj = transformFlowToYaml(nodes, edges);
        const yamlStr = yaml.dump(yamlObj);

        const blob = new Blob([yamlStr], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'workflow.yaml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
                            label: newData.label
                        };
                    }
                    return edge;
                })
            );
            setSelectedItem((prev: any) => prev ? { ...prev, label: newData.label } : null);
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
                    onClose={() => setSelectedItem(null)}
                />
            </EditorContainer>

            <FloatingControls>
                <h1>Workflow Visualizer</h1>
                <div style={{ pointerEvents: 'auto' }}>
                    <Upload onLoad={handleYamlLoad} />
                </div>
                <ControlButton onClick={onAddNode}>+ Add Node</ControlButton>
                <ControlButton style={{ backgroundColor: '#1890ff' }} onClick={onExport}>Download YAML</ControlButton>
            </FloatingControls>
        </Layout>
    );
};
