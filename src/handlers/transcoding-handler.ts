import { SQSEvent } from 'aws-lambda';
import { Task } from '../types/task.types'


export const transcodingHandler = async(message:SQSEvent):Promise<any> => {
    console.warn(message);
    
};
