function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function getWebviewContent() {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                canvas {
                    width: 100%;
                    height: auto;
                }
                #variablesTable {
                    border-collapse: collapse;
                    width: 100%;
                    border: 1px solid #ddd;
                }
                #variablesTable th, #variablesTable td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
            </style>
            <script>
                const vscode = acquireVsCodeApi();

                let breakpointHistory = [];

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updatePanel':
                            breakpointHistory = message.breakpointHistory.sort((a, b) => a.globalIdx - b.globalIdx);
                            updateGraphAndTable();
                            break;
                    }
                });

                function getColorBasedOnString(inputString) {
                    const colors = [
                        '#FF6384', '#36A2EB', '#FFCE56', // Red, Blue, Yellow
                        '#4BC0C0', '#9966FF', '#C9CBCF',  // Teal, Purple, Grey
                        '#FF8A80', '#EA80FC', '#B388FF',  // Dark Red, Dark Purple, Light Purple
                    ];
                    function hash() {
                        // A simple hash function
                        let hash = 0;
                        for (let i = 0; i < inputString.length; i++) {
                            const char = inputString.charCodeAt(i);
                            hash = ((hash << 5) - hash) + char;
                            hash = hash & hash; // Convert to 32bit integer
                        }
                        return Math.abs(hash);
                    }
                    const index = hash() % colors.length;
                    return colors[index];
                }

                function getOrCreateChart() {
                    const container = document.getElementById('graphContainer');
                    let canvas = container.querySelector('canvas');
                    if (!canvas) {
                        canvas = document.createElement('canvas');
                        container.appendChild(canvas);
                    }
                    if (!window.myChart) {
                        const ctx = canvas.getContext('2d');
                        window.myChart = new Chart(ctx, {
                            type: 'line', // Default type, could make this dynamic
                            data: {
                                labels: [],
                                datasets: []
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    x: {
                                        stacked: true,
                                    },
                                    y: {
                                        // stacked: true
                                    }
                                }
                            }
                        });
                    }
                    return window.myChart;
                }

                function updateGraph() {
                    const map = new Map();
                    breakpointHistory.forEach(record => Object.keys(record.results).forEach(name => {
                        const compositeKey = \`Thread\${record.threadId}.\${name}\`;
                        if (!map.has(compositeKey)) {
                            map.set(compositeKey, []);
                        }
                        map.get(compositeKey).push({
                            x: record.globalIdx,
                            y: record.results[name]
                        });
                    }));
                    const chart = getOrCreateChart();
                    chart.data.datasets = chart.data.datasets.filter(ds => map.has(ds.label));
                    for (const [variableName, dataPoints] of map.entries()) {
                        let dataset = chart.data.datasets.find(ds => ds.label === variableName);

                        if (!dataset) {
                            const color = getColorBasedOnString(variableName);
                            dataset = {
                                label: variableName,
                                backgroundColor: color,
                                borderColor: color,
                                data: [],
                            };
                            chart.data.datasets.push(dataset);
                        }

                        dataset.data = dataPoints;
                    }
                    chart.data.labels = [...breakpointHistory.map(x => x.globalIdx)];
                    chart.update();
                }

                function updateTable() {
                    const table = document.getElementById('variablesTable');
                    table.innerHTML = ''; // Clear existing data

                    // Get all unique variable names across all history records
                    const map = new Map();
                    breakpointHistory.forEach(record => Object.keys(record.results).forEach(name => {
                        const compositeKey = \`Thread\${record.threadId}.\${name}\`;
                        if (!map.has(compositeKey)) {
                            map.set(compositeKey, []);
                        }
                        map.get(compositeKey).push(record.results[name]);
                    }));

                    map.forEach((results, compositeKey) => {
                        const row = document.createElement('tr');
                        const nameCell = document.createElement('td');
                        nameCell.textContent = compositeKey;
                        row.appendChild(nameCell);

                        const valuesCell = document.createElement('td');
                        valuesCell.textContent = results.join(', ');
                        row.appendChild(valuesCell);

                        table.appendChild(row);
                    });
                }


                function updateGraphAndTable() {
                    updateGraph();
                    updateTable();
                }
            </script>
        </head>
        <body>
            <div id="graphContainer" style="width:100%; height:400px;">
            </div>
            <h3>Variables</h3>
            <table id="variablesTable">
            </table>
        </body>
        </html>`;
}