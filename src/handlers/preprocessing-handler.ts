import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

import { 
    SQSEvent,
    S3BatchEvent,
    SQSBatchItemFailure,
    SQSBatchResponse,
} from 'aws-lambda';

import {
    KeyOwner,
    getOwner
} from '../utils/key-service'

import {
    ErrorName,
    CustomError,
    exceptionHandlerFunction,
    Fault,
} from '../utils/error-handling';

import { SourceMetadata } from '../types/metadata.types';
import { ObjectService } from '../services/storage/object-service';
import { MetadataExtractor } from '../services/transcoding/content-metadata-service';
import { ContentValidationService } from '../services/transcoding/content-validation-service';
import { TaskCreator } from '../utils/task-creator';

import { 
    TaskType,
    WorkerType,
    Task,
    Location,
} from '../types/task.types';

import { 
    MetadataCache,
    MetadataPath,
    ProcessingStage
} from '../services/storage/metadata-storage-service';

import { 
    SQSClient,
    SendMessageCommand,
    DeleteMessageCommand,
 } from '@aws-sdk/client-sqs';


interface PreprocessingResult{
    userId:string;
    assetId:string;
    metadata:SourceMetadata,
}

interface PreprocessingResults{
    Records:PreprocessingResult[];
}


if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || '/opt/ffprobe/ffprobe');
}


const contentValidationService = new ContentValidationService();
const metadataExtractor = new MetadataExtractor();
const transportObjectService = new ObjectService(process.env.AWS_DEFAULT_REGION!,process.env.TRANSPORTSTORAGE_BUCKET_NAME!);
const metadataCache = new MetadataCache(process.env.METADATASTORAGE_TABLE_NAME!,process.env.AWS_DEFAULT_REGION!);
const sqs = new SQSClient({region:process.env.AWS_DEFAULT_REGION!});


const initSourceContentFunc = async(key:string):Promise<string> => {
    const object = await transportObjectService.getObject(key);
    if (!object){
        throw new CustomError(ErrorName.OBJECT_SERVICE_ERROR,"Unable to get object from Object Storage",503,Fault.SERVER,true);
    }

    const filePath = await transportObjectService.writeToTemp(object);
    if (!path) {
        throw new CustomError(ErrorName.OBJECT_SERVICE_ERROR,"Unable to store object in tmp",503,Fault.SERVER,true);
    }
    return filePath;
};


export const preprocessingHandler = async(messages: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];

    try{

        // for(const message of messages.Records){
        //     const s3Events:



        // }



        return {batchItemFailures: batchItemFailures};
    } catch (error) {
        exceptionHandlerFunction(error);
        return {batchItemFailures: batchItemFailures};
    }    
};



// check in dynamodb if record is there this is just to safely ensure we can abort the process 
// 



// DLQ to finally mark jobs as failed

// try{
    // for (const message of messages.Records){
    //     const s3Events:S3Event = JSON.parse(message.body);

    //     for (const event of s3Events.Records){
//             // Get the source object and store it in tmp
//             const key: string = event.s3.object.key;
//             const bucket: string = event.s3.bucket.name;
//             const filePath: string = await initSourceContentFunc(key);

//             const owner:KeyOwner = getOwner(key);
//             const userId = owner.userId;
//             const assetId = owner.assetId;
//             // Initialize in metadata storage
//             await metadataCache.InitializeRecord(userId,assetId);
//             await metadataCache.updateProgress(userId, assetId, ProcessingStage.UPLOAD,true);

//             // Run FFprobe Validations on source
//             const contentValidationResult = await contentValidationService.validateContent(filePath);

//             if (!contentValidationResult.success){
//                 await metadataCache.markCriticalFailure(userId,assetId,true);

//                 throw new CustomError (
//                     ErrorName.VALIDATION_ERROR,
//                     contentValidationResult.error,
//                     400,
//                     Fault.CLIENT,
//                     true
//                 );
//             }
                        
        
//             await metadataCache.updateProgress(userId, assetId, ProcessingStage.VALIDATION,true);

//             // extract useful metadata from the source
//             const contentMetadataResult = await metadataExtractor.getContentMetadata(filePath);
//             await metadataCache.updateProgress(userId, assetId, ProcessingStage.METADATA,true);

//             const sourceMetadata:SourceMetadata ={
//                 validation:{
//                     basic:contentValidationResult.basic,
//                     stream:contentValidationResult.stream
//                 },
//                 metadata:{
//                     technical:contentMetadataResult.technical,
//                     quality:contentMetadataResult.quality,
//                     content:contentMetadataResult.content,
//                 }
//             };

//             // update in metadata cache
//             await metadataCache.updateMetadata(userId,assetId,MetadataPath.VALIDATION_BASIC,contentValidationResult.basic);
//             await metadataCache.updateMetadata(userId,assetId,MetadataPath.VALIDATION_STREAM,contentValidationResult.stream);
//             await metadataCache.updateMetadata(userId,assetId,MetadataPath.METADATA_TECHNICAL,contentMetadataResult.technical);
//             await metadataCache.updateMetadata(userId,assetId,MetadataPath.METADATA_QUALITY,contentMetadataResult.quality);
//             await metadataCache.updateMetadata(userId,assetId,MetadataPath.METADATA_CONTENT,contentMetadataResult.content);

//             // Task Creation
//             const input: Location = {
//                 Bucket: bucket,
//                 Key: key,
//             }

//             const output: Location = {
//                 Bucket: process.env.CONTENTSTORAGE_BUCKET_NAME!,
//                 Key: `${userId}/${assetId}/gops`
//             }


//             const task = TaskCreator.createTask(userId,assetId,input,output,TaskType.GOP_CREATION,WorkerType.GOP_WORKER,sourceMetadata);

//             const sendMessageCommand = new SendMessageCommand({
//                 QueueUrl: process.env.MEDIASEGMENTERQUEUE_QUEUE_URL!,
//                 MessageBody: JSON.stringify({
//                     task
//                 })        
//             });

//             const response = await sqs.send(sendMessageCommand);
//             if(!response || response.$metadata.httpStatusCode !== 200){
//                 throw new CustomError(
//                     ErrorName.INTERNAL_ERROR,
//                     "Unable to send message to queue",
//                     503,
//                     Fault.SERVER,
//                     true
//                 );
//             }
//             // clean up
//             await transportObjectService.cleanUpFromTemp(filePath);
//         }
//     }

//     return{
//         statusCode:200,
//         message: "Validation Successful",
//     }
// } catch(error){
//     const errorResponse = exceptionHandlerFunction(error);
// }