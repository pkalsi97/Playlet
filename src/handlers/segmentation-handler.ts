import { SQSEvent } from "aws-lambda";

export const segmentationHandler = async(message:SQSEvent):Promise<any> => {
    console.warn(message);
};

// policies
// call worker 
