const { BigQuery } = require('@google-cloud/bigquery');
const { google } = require('googleapis');
const TransactionTracer = require('./TransactionTracer');
require('dotenv').config();

class GoogleCloudIntentAnalytics {
    constructor() {
        this.bigquery = new BigQuery({
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
        this.tracer = new TransactionTracer(process.env.SEPOLIA_RPC_URL);
        this.datasetId = process.env.BIGQUERY_DATASET;
        this.tableId = 'intent_transactions';
    }

    async createAnalyticsTable() {
        const schema = [
            { name: 'intent_id', type: 'STRING' },
            { name: 'transaction_hash', type: 'STRING' },
            { name: 'from_token', type: 'STRING' },
            { name: 'to_token', type: 'STRING' },
            { name: 'amount', type: 'STRING' },
            { name: 'gas_used', type: 'INTEGER' },
            { name: 'timestamp', type: 'TIMESTAMP' },
            { name: 'status', type: 'STRING' },
            { name: 'optimization_suggestions', type: 'STRING' },
            { name: 'dex_interactions', type: 'STRING' },
            { name: 'bridge_data', type: 'STRING' }
        ];

        const options = {
            schema: schema,
            timePartitioning: {
                type: 'DAY',
                field: 'timestamp'
            }
        };

        await this.bigquery
            .dataset(this.datasetId)
            .table(this.tableId)
            .create(options);
    }

    async trackIntent(intentId, txHash, fromToken, toToken, amount) {
        try {
            // Get transaction trace using GCP's debug_traceTransaction
            const trace = await this.tracer.traceTransaction(txHash);
            const swapAnalysis = await this.tracer.analyzeSwapExecution(txHash);
            const gasAnalysis = await this.tracer.estimateOptimalGas(txHash);

            // Prepare data for BigQuery
            const row = {
                intent_id: intentId,
                transaction_hash: txHash,
                from_token: fromToken,
                to_token: toToken,
                amount: amount.toString(),
                gas_used: parseInt(gasAnalysis.totalGasUsed),
                timestamp: new Date(),
                status: 'completed',
                optimization_suggestions: JSON.stringify(gasAnalysis.recommendations),
                dex_interactions: JSON.stringify(swapAnalysis.dexInteractions),
                bridge_data: JSON.stringify(trace)
            };

            // Insert into BigQuery
            await this.bigquery
                .dataset(this.datasetId)
                .table(this.tableId)
                .insert([row]);

            // Update Google Sheets dashboard
            await this.updateDashboard(row);

            return {
                success: true,
                data: row
            };
        } catch (error) {
            console.error('Error tracking intent:', error);
            throw error;
        }
    }

    async updateDashboard(data) {
        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            const sheets = google.sheets({ version: 'v4', auth });
            
            // Format data for sheets
            const values = [[
                data.intent_id,
                data.transaction_hash,
                data.from_token,
                data.to_token,
                data.amount,
                data.gas_used.toString(),
                new Date(data.timestamp).toISOString(),
                data.status
            ]];

            await sheets.spreadsheets.values.append({
                spreadsheetId: process.env.GOOGLE_SHEETS_DASHBOARD_ID,
                range: `${process.env.GOOGLE_SHEETS_TAB_NAME}!A:H`,
                valueInputOption: 'RAW',
                resource: { values }
            });
        } catch (error) {
            console.error('Error updating dashboard:', error);
            // Don't throw here - dashboard updates are non-critical
        }
    }

    async getAnalytics(startDate, endDate) {
        const query = `
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as total_intents,
                AVG(gas_used) as avg_gas_used,
                COUNT(DISTINCT from_token) as unique_source_tokens,
                COUNT(DISTINCT to_token) as unique_target_tokens
            FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${this.datasetId}.${this.tableId}\`
            WHERE timestamp BETWEEN @startDate AND @endDate
            GROUP BY date
            ORDER BY date DESC
        `;

        const options = {
            query: query,
            params: { startDate: startDate, endDate: endDate }
        };

        const [rows] = await this.bigquery.query(options);
        return rows;
    }
}

module.exports = GoogleCloudIntentAnalytics;
