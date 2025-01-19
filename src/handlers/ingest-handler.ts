import {
    ConditionalCheckFailedException
} from '@aws-sdk/client-dynamodb'

import {
    SQSClient,
    SendMessageCommand,
} from '@aws-sdk/client-sqs'

import { 
    SQSEvent,
    SQSBatchResponse,
    SQSBatchItemFailure,
    S3Event
} from 'aws-lambda'

import {
    CustomError,
    Fault,
    ErrorName,
    exceptionHandlerFunction
} from '../utils/error-handling'

import {
    MetadataPath,
    ProcessingStage,
    MetadataCache,
} from '../services/storage/metadata-storage-service'

import { 
    KeyOwner,
    getOwner 
} from '../utils/key-service'

import {
    TaskType,
    WorkerType,
    Task,
    Location
} from '../types/task.types'

import { TaskCreator } from '../utils/task-creator'

interface FailedEvent {
    bucket: string;
    key: string;
}

const metadataCache = new MetadataCache(
    process.env.METADATASTORAGE_TABLE_NAME!,
    process.env.AWS_DEFAULT_REGION!
);

const sqs = new SQSClient({ 
    region: process.env.AWS_DEFAULT_REGION!
});

export const ingestHandler = async(messages:SQSEvent):Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    const failedS3Events: FailedEvent[] = [];
    await Promise.all(
        messages.Records.map(async (sqsRecord) =>{
            try{
                const s3Events = JSON.parse(sqsRecord.body) as S3Event;
                await Promise.all(
                    s3Events.Records.map(async (s3Event) =>{
                        const key:string = s3Event.s3.object.key;
                        const bucket:string = s3Event.s3.bucket.name;
                        try{
                            const owner: KeyOwner = getOwner(key);
                            const userId: string = owner.userId;
                            const assetId: string = owner.assetId;

                            if(!await metadataCache.InitializeRecord(userId,assetId)){
                                throw new CustomError(
                                    ErrorName.INTERNAL_ERROR,
                                    "Failed to initialize in Metadata Cache",
                                    503,
                                    Fault.SERVER,
                                    true
                                );
                            }
                            await metadataCache.updateProgress(userId,assetId,ProcessingStage.UPLOAD,true);

                            const input:Location = {
                                Key:key,
                                Bucket:bucket,
                            }

                            const task:Task = TaskCreator.createTask(userId,assetId,input,{},TaskType.TRANSCODE,WorkerType.PROCESSOR,);

                            const command = new SendMessageCommand({
                                QueueUrl:process.env.TASKQUEUE_QUEUE_URL!,
                                MessageBody: JSON.stringify(task),
                            });

                            const response = await sqs.send(command);
                            if(response.$metadata.httpStatusCode!==200){
                                throw new CustomError(
                                    ErrorName.INTERNAL_ERROR,
                                    "Unable to send message to Task Queue",
                                    503,
                                    Fault.SERVER,
                                    true
                                );
                            }

                        }catch(error){
                            const errorResponse =exceptionHandlerFunction(error);
                            if (errorResponse.metadata.name !== 'ConditionalCheckFailedException'){
                                failedS3Events.push({
                                    key,
                                    bucket,
                                });
                            } 
                        }
                    })
                );
            }catch(error){
                exceptionHandlerFunction(error);
                batchItemFailures.push({
                    itemIdentifier: sqsRecord.messageId
                });
            }
        })
    );

    return {batchItemFailures};
};

// Pending Where to send Failed s3 events, how can they be managed
