import React, { useMemo } from 'react';
import Graph from 'react-vis-network-graph';

const StudyPlanGraph = ({ plan, onNodeClick }) => {
    // Detect dark mode roughly (or pass it in). For now, we'll try to stick to neutral colors or check document class
    const isDarkMode = document.documentElement.classList.contains('dark');

    const graphData = useMemo(() => {
        if (!plan || plan.length === 0) return { nodes: [], edges: [] };

        console.log("Graph Rendering Plan:", JSON.stringify(plan, null, 2));

        const nodes = [];
        const edges = [];

        plan.forEach((module, mIndex) => {
            // Create Module Node
            const moduleId = `m-${mIndex}`;

            let modBg = isDarkMode ? '#1e3a8a' : '#dbeafe'; // Default Blue
            let modBorder = isDarkMode ? '#60a5fa' : '#2563eb';

            if (module.status === 'completed') {
                modBg = isDarkMode ? '#064e3b' : '#dcfce7'; // Green
                modBorder = '#22c55e';
            } else if (module.status === 'in-progress') {
                modBg = isDarkMode ? '#581c87' : '#f3e8ff'; // Purple
                modBorder = '#a855f7';
            }

            nodes.push({
                id: moduleId,
                label: module.topic,
                title: module.description,
                color: {
                    background: modBg,
                    border: modBorder,
                    highlight: { background: modBg, border: modBorder }
                },
                font: { size: 18, face: 'bold', color: isDarkMode ? '#f3f4f6' : '#1f2937' },
                shape: 'box',
                margin: 12,
                widthConstraint: { maximum: 200 }
            });

            // Process Subtopics
            if (module.subtopics && module.subtopics.length > 0) {
                module.subtopics.forEach((sub, sIndex) => {
                    const subId = `s-${mIndex}-${sIndex}`;

                    let bgColor = isDarkMode ? '#4b5563' : '#e5e7eb'; // Darker gray default
                    let borderColor = isDarkMode ? '#9ca3af' : '#9ca3af'; // Visible border
                    let fontColor = isDarkMode ? '#e5e7eb' : '#374151';

                    if (sub.status === 'completed') {
                        bgColor = isDarkMode ? '#064e3b' : '#dcfce7'; // Dark green vs Light green
                        borderColor = '#22c55e';
                        fontColor = isDarkMode ? '#f0fdf4' : '#166534';
                    } else if (sub.status === 'in-progress') {
                        bgColor = isDarkMode ? '#581c87' : '#f3e8ff'; // Dark purple vs Light purple
                        borderColor = '#a855f7';
                        fontColor = isDarkMode ? '#faf5ff' : '#6b21a8';
                    }

                    nodes.push({
                        id: subId,
                        label: sub.topic,
                        title: sub.description,
                        color: {
                            background: bgColor,
                            border: borderColor,
                            highlight: { background: bgColor, border: borderColor }
                        },
                        font: { size: 14, color: fontColor },
                        shape: 'box',
                        widthConstraint: { maximum: 180 }
                    });

                    // Edge: Module -> Subtopic
                    edges.push({
                        from: moduleId,
                        to: subId,
                        color: { color: isDarkMode ? '#4b5563' : '#cbd5e1', opacity: 0.5 },
                        dashes: true
                    });

                    // Edge: Subtopic -> Next Subtopic (Sequence)
                    if (sIndex > 0) {
                        const prevSubId = `s-${mIndex}-${sIndex - 1}`;
                        edges.push({
                            from: prevSubId,
                            to: subId,
                            arrows: 'to',
                            color: { color: isDarkMode ? '#6b7280' : '#9ca3af' }
                        });
                    }
                });

                // Link modules for flow
                if (mIndex > 0) {
                    const prevModuleId = `m-${mIndex - 1}`;
                    edges.push({
                        from: prevModuleId,
                        to: moduleId,
                        arrows: 'to',
                        color: { color: '#3b82f6', width: 2 } // Blue prominent line
                    });
                }
            } else {
                if (mIndex > 0) {
                    const prevModuleId = `m-${mIndex - 1}`;
                    edges.push({
                        from: prevModuleId,
                        to: moduleId,
                        arrows: 'to'
                    });
                }
            }
        });

        return { nodes, edges };
    }, [plan, isDarkMode]);

    const options = {
        layout: {
            hierarchical: {
                direction: 'UD', // Up-Down
                sortMethod: 'directed',
                levelSeparation: 150,
                nodeSpacing: 200
            }
        },
        interaction: { hover: true, zoomView: true },
        physics: { enabled: false },
        height: '400px'
    };

    const events = {
        select: function (event) {
            const { nodes } = event;
            if (nodes.length > 0 && onNodeClick) {
                onNodeClick(nodes[0]);
            }
        }
    };

    return (
        <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            <Graph
                graph={graphData}
                options={options}
                events={events}
            />
        </div>
    );
};

export default StudyPlanGraph;
