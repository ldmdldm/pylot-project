-- Find the best route for PYUSD swaps across all protocols
WITH RankedRoutes AS (
  SELECT 
    protocol,
    route_id,
    input_token,
    output_token,
    input_amount,
    output_amount,
    gas_cost,
    execution_time,
    slippage,
    path,
    priority_score,
    -- Calculate effective rate considering gas and slippage
    (output_amount - (gas_cost * 0.00001)) / input_amount AS effective_rate,
    ROW_NUMBER() OVER (
      PARTITION BY input_token, output_token, input_amount 
      ORDER BY priority_score DESC, 
               (output_amount - (gas_cost * 0.00001)) / input_amount DESC,
               execution_time ASC
    ) as rank
  FROM 
    pyusd_intent_system.dex_routes
  WHERE 
    timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
    AND (input_token = 'PYUSD' OR output_token = 'PYUSD')
)
SELECT 
  protocol,
  input_token,
  output_token,
  input_amount,
  output_amount,
  gas_cost,
  execution_time,
  slippage,
  path,
  effective_rate,
  priority_score
FROM 
  RankedRoutes
WHERE 
  rank = 1
ORDER BY 
  effective_rate DESC;
