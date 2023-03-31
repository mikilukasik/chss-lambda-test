//@ ts-expect-error
import * as loadTf from "tfjs-node-lambda";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  Context,
} from "aws-lambda";
import { fen2intArray } from "../chss-module-engine/src/engine_new/transformers/fen2intArray";
import { predict } from "../chss-module-engine/src/engine_new/tfHelpers/predict";

type Tf = typeof import("@tensorflow/tfjs");

const modelPath = "dist/smallPredict/model.json";
const tfPath = "./dist/smallPredict/nodejs16.x-tf4.2.0.br";

let tf: Tf | null = null;
let loadedModel: Tf["LayersModel"] | null = null;
let loadFailed = false as any;

const modelAwaiters: ((
  value: Tf["LayersModel"] | PromiseLike<Tf["LayersModel"]>
) => void)[] = [];
const modelRejectors: ((err: any) => void)[] = [];

const getModel = async (): Promise<Tf["LayersModel"]> =>
  new Promise(async (res, rej) => {
    if (loadFailed) return rej(loadFailed);
    if (loadedModel) return res(loadedModel);
    modelAwaiters.push(res);
    modelRejectors.push(rej);
  });

const modelLoadErrorCatcher = (err: any) => {
  console.log("failed to load model.");
  console.error(err);

  loadFailed = err;
  while (modelRejectors.length) (modelRejectors.pop() || ((_) => {}))(err);
  modelAwaiters.length = 0;
};

(async () => {
  const readStream = fs.createReadStream(path.resolve(tfPath));
  tf = await loadTf(readStream);

  if (!tf) throw new Error("could not load tf");

  return tf.loadLayersModel("file://" + modelPath).then((model: any) => {
    console.log("model loaded.");
    loadedModel = model;
    while (modelAwaiters.length) (modelAwaiters.pop() || ((_) => {}))(model);
    modelRejectors.length = 0;
  });
})().catch(modelLoadErrorCatcher);

const hexToDec = (hex: string) => Number(`0x${hex}`);
const transformLmfLmt = (lmflmtStr: string) => {
  const result = [];
  for (let i = 0; i < 128; i += 2) {
    result.push(hexToDec(lmflmtStr.substring(i, i + 2)));
  }
  return result;
};

exports.handler = (async (event: APIGatewayProxyEvent, context: Context) => {
  try {
    const {
      fen,
      lmf: lmfStr,
      lmt: lmtStr,
    } = event.queryStringParameters as {
      fen: string;
      lmf: string;
      lmt: string;
    };

    const board = fen2intArray(fen);
    const lmf = transformLmfLmt(lmfStr);
    const lmt = transformLmfLmt(lmtStr);

    const model = await getModel();

    const { winningMoveString } = await predict({ board, lmf, lmt, model, tf });

    return {
      statusCode: 200,
      body: JSON.stringify({
        winningMoveString,
      }),
    };
  } catch (error: any) {
    console.error("Error during prediction:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `An error occurred while making a prediction: ${error.message}`,
      }),
    };
  }
}) as APIGatewayProxyHandler;
