import { AthenaClient, GetQueryExecutionCommand, StartQueryExecutionCommand } from "@aws-sdk/client-athena";

const athena = new AthenaClient({ apiVersion: '2017-05-18', region: 'us-east-1' });
const { ATHENA_QUERY_RESULTS_LOCATION } = process.env;

const waitForQueryExecution = async (queryExecutionId, getOutputLocation) => {
  while (true) {
    const getQueryExecutionCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId });
    const data = await athena.send(getQueryExecutionCommand)
    const queryExecution = data?.QueryExecution
    const state = queryExecution?.Status?.State;

    if (state === 'SUCCEEDED') {
      if (getOutputLocation) {
        return queryExecution?.ResultConfiguration?.OutputLocation;
      }
      return;
    } else if (state === 'FAILED' || state === 'CANCELLED') {
      throw Error(`Query ${queryExecutionId} failed: ${data.QueryExecution.Status.StateChangeReason}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

const runQuery = async (query, getOutputLocation = false) => {
  const params = {
    QueryString: query,
    ResultConfiguration: { OutputLocation: ATHENA_QUERY_RESULTS_LOCATION }
  };

  const startQueryExecutionCommand = new StartQueryExecutionCommand(params);
  return athena.send(startQueryExecutionCommand)
    .then(data => waitForQueryExecution(data.QueryExecutionId, getOutputLocation));
};

export { runQuery };
