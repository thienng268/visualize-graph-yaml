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
import { transformYamlToFlow } from '../utils/transform';
import { getLayoutedElements } from '../utils/layout';
import { transformFlowToYaml } from '../utils/reverseTransform';
import { CustomNode } from './CustomNode';

const nodeTypes = {
    custom: CustomNode,
};

const EditorContainer = styled.div`
  height: 80vh;
  width: 100%;
  border: 1px solid #ddd;
  position: relative;
`;

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px;
  height: 100vh;
  box-sizing: border-box;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const AddButton = styled.button`
    background-color: #52c41a;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    margin-left: 10px;
    
    &:hover {
        background-color: #73d13d;
    }
`;

export const FlowEditor: React.FC = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [itemType, setItemType] = useState<'node' | 'edge' | null>(null);

    const [rfInstance, setRfInstance] = useState<any>(null);
    const edgeReconnectSuccessful = useRef(false);

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
            <Header>
                <h1>Workflow Visualizer</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Upload onLoad={handleYamlLoad} />
                    <AddButton onClick={onAddNode}>+ Add Node</AddButton>
                    <AddButton style={{ backgroundColor: '#1890ff' }} onClick={onExport}>Download YAML</AddButton>
                </div>
            </Header>

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

                <PropertiesPanel
                    selectedItem={selectedItem}
                    itemType={itemType}
                    onUpdate={updateData}
                    onDelete={onDeleteItem}
                    onClose={() => setSelectedItem(null)}
                />
            </EditorContainer>
        </Layout>
    );
};
